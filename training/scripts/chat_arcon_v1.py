#!/usr/bin/env python3
"""Interactive chat with trained Arcon V1 model."""

import json
import os
import sys
import time
from datetime import datetime

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import PeftModel, PeftConfig


def get_gpu_mem():
    if not torch.cuda.is_available():
        return {"allocated_MB": 0, "reserved_MB": 0, "max_allocated_MB": 0}
    return {
        "allocated_MB": round(torch.cuda.memory_allocated() / 1024**2, 1),
        "reserved_MB": round(torch.cuda.memory_reserved() / 1024**2, 1),
        "max_allocated_MB": round(torch.cuda.max_memory_allocated() / 1024**2, 1),
    }


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    adapter_path = os.path.join(base_dir, "outputs", "arcon-v1", "adapter")
    model_name = "Qwen/Qwen3-4B"

    print("=" * 60)
    print("Arcon V1 Interactive Chat")
    print("=" * 60)
    print()

    # Load tokenizer
    print("[1/4] Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    print(f"  Tokenizer: {type(tokenizer).__name__}")

    # Load model in 4-bit
    print("[2/4] Loading Qwen3-4B in 4-bit NF4...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        trust_remote_code=True,
        quantization_config=bnb_config,
        device_map="cuda",
        dtype=torch.float16,
    )
    mem_after_model = get_gpu_mem()
    print(f"  Model loaded. GPU: {mem_after_model['allocated_MB']} MB allocated")

    # Load LoRA adapter
    print("[3/4] Loading Arcon V1 LoRA adapter...")
    peft_cfg = PeftConfig.from_pretrained(adapter_path)
    model = PeftModel.from_pretrained(model, adapter_path)
    model.eval()
    mem_after_lora = get_gpu_mem()
    print(f"  Adapter loaded. GPU: {mem_after_lora['allocated_MB']} MB allocated")
    print(f"  Adapter path: {adapter_path}")
    print(f"  Base model: {peft_cfg.base_model_name_or_path}")
    print(f"  LoRA rank: {peft_cfg.r}")
    print(f"  Target modules: {peft_cfg.target_modules}")
    print()

    # Show GPU summary
    print("[4/4] GPU Memory Summary:")
    print(f"  Allocated: {mem_after_lora['allocated_MB']} MB")
    print(f"  Reserved: {mem_after_lora['reserved_MB']} MB")
    if torch.cuda.is_available():
        print(f"  Total VRAM: {round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 2)} GB")
    print()

    print("=" * 60)
    print("Arcon V1 is ready. Type your message and press Enter.")
    print("Type 'exit' or press Ctrl+C to quit.")
    print("=" * 60)
    print()

    # Chat history
    messages = []

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue
        if user_input.lower() in ["exit", "quit"]:
            print("Goodbye!")
            break

        messages.append({"role": "user", "content": user_input})

        # Generate response
        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = tokenizer([text], return_tensors="pt").to(model.device)

        start_time = time.time()
        with torch.no_grad():
            out = model.generate(
                **inputs,
                max_new_tokens=256,
                temperature=0.7,
                top_p=0.9,
                repetition_penalty=1.1,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
            )
        elapsed = time.time() - start_time

        response = tokenizer.decode(out[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        messages.append({"role": "assistant", "content": response})

        print(f"Arcon: {response}")
        print(f"[{elapsed:.2f}s]")
        print()


if __name__ == "__main__":
    main()
