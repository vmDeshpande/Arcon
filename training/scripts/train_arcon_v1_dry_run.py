#!/usr/bin/env python3
"""One-step dry run for Arcon V1 QLoRA training."""

import json
import os
import time
from datetime import datetime

import torch
import psutil
from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    BitsAndBytesConfig,
)
from peft import (
    LoraConfig,
    get_peft_model,
    prepare_model_for_kbit_training,
)
from datasets import Dataset


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


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
    dataset_dir = os.path.join(base_dir, "datasets", "arcon_v1")
    train_path = os.path.join(dataset_dir, "train.jsonl")

    print("=" * 60)
    print("Arcon V1 QLoRA Dry Run (1 step)")
    print("=" * 60)

    # Load dataset
    log("Loading dataset...")
    train_examples = []
    with open(train_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                train_examples.append(json.loads(line))
    log(f"Loaded {len(train_examples)} training examples")

    # Load tokenizer
    log("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        "Qwen/Qwen3-4B",
        trust_remote_code=True,
        use_fast=True,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # Load model
    log("Loading model in 4-bit...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    model = AutoModelForCausalLM.from_pretrained(
        "Qwen/Qwen3-4B",
        trust_remote_code=True,
        quantization_config=bnb_config,
        device_map="cuda",
        dtype=torch.float16,
    )
    mem_after_model = get_gpu_mem()
    log(f"Model loaded. GPU: allocated={mem_after_model['allocated_MB']} MB, reserved={mem_after_model['reserved_MB']} MB")

    # LoRA
    log("Attaching LoRA...")
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=False)
    lora_config = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj", "k_proj", "v_proj", "o_proj",
            "gate_proj", "up_proj", "down_proj",
        ],
    )
    model = get_peft_model(model, lora_config)
    model.train()
    mem_after_lora = get_gpu_mem()
    log(f"LoRA attached. GPU: allocated={mem_after_lora['allocated_MB']} MB, reserved={mem_after_lora['reserved_MB']} MB")

    trainable_params, total_params = model.get_nb_trainable_parameters()
    log(f"Trainable: {trainable_params:,} / Total: {total_params:,}")

    # Tokenize one example
    log("Tokenizing one example...")
    example = train_examples[0]
    text = tokenizer.apply_chat_template(
        example["messages"],
        tokenize=False,
        add_generation_prompt=False,
    )
    encoded = tokenizer(
        text,
        truncation=True,
        max_length=128,
        return_tensors="pt",
    )
    input_ids = encoded["input_ids"].to("cuda")
    attention_mask = encoded["attention_mask"].to("cuda")
    labels = input_ids.clone()
    log(f"Input shape: {input_ids.shape}")

    # One training step
    log("Running one training step...")
    optimizer = torch.optim.AdamW(model.parameters(), lr=2e-4)
    torch.cuda.reset_peak_memory_stats()

    step_start = time.time()
    optimizer.zero_grad()
    outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)
    loss = outputs.loss
    loss.backward()
    optimizer.step()
    step_time = time.time() - step_start

    mem_peak = get_gpu_mem()
    log(f"Step complete. Loss: {loss.item():.4f} | Time: {step_time:.2f}s")
    log(f"Peak GPU: allocated={mem_peak['allocated_MB']} MB, max={mem_peak['max_allocated_MB']} MB")

    # Smoke test generation
    log("Running smoke test generation...")
    model.eval()
    test_messages = [{"role": "user", "content": "Who are you?"}]
    test_text = tokenizer.apply_chat_template(
        test_messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    test_inputs = tokenizer([test_text], return_tensors="pt").to("cuda")
    with torch.no_grad():
        out = model.generate(
            **test_inputs,
            max_new_tokens=64,
            temperature=0.7,
            top_p=0.9,
            repetition_penalty=1.1,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    response = tokenizer.decode(out[0][test_inputs.input_ids.shape[1]:], skip_special_tokens=True)
    log(f"Response: {response[:200]}")

    print()
    print("=" * 60)
    print("DRY RUN PASSED")
    print("=" * 60)
    print("Model: Qwen/Qwen3-4B")
    print("Quantization: 4-bit NF4")
    print("Compute dtype: float16")
    print("Device map: cuda")
    print("LoRA rank: 8")
    print("Sequence length: 128")
    print("Batch size: 1")
    print("Trainable params: " + str(trainable_params))
    print("Step loss: " + str(round(loss.item(), 4)))
    print("Step time: " + str(round(step_time, 2)) + "s")
    print("Peak VRAM: " + str(mem_peak['max_allocated_MB']) + " MB")
    print("Ready for full Training V1.")


if __name__ == "__main__":
    main()
