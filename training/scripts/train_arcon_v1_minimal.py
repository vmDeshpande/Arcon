#!/usr/bin/env python3
"""Minimal Arcon V1 training with explicit file logging."""

import json
import os
import sys
import time
from datetime import datetime

# Force unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

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

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs", "arcon-v1")
os.makedirs(OUTPUT_DIR, exist_ok=True)
LOG_PATH = os.path.join(OUTPUT_DIR, "training-log.txt")

def log(msg):
    line = f"[{datetime.now().strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(line + "\n")

def get_gpu_mem():
    if not torch.cuda.is_available():
        return {"allocated_MB": 0, "reserved_MB": 0, "max_allocated_MB": 0}
    return {
        "allocated_MB": round(torch.cuda.memory_allocated() / 1024**2, 1),
        "reserved_MB": round(torch.cuda.memory_reserved() / 1024**2, 1),
        "max_allocated_MB": round(torch.cuda.max_memory_allocated() / 1024**2, 1),
    }

def main():
    log("=" * 60)
    log("Arcon V1 QLoRA Training - Minimal Script")
    log("=" * 60)

    # Clear log
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        f.write("")

    log(f"Python: {os.sys.version}")
    log(f"PyTorch: {torch.__version__}")
    log(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        log(f"CUDA version: {torch.version.cuda}")
        log(f"GPU: {torch.cuda.get_device_name(0)}")
        log(f"Total VRAM: {round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 2)} GB")
    log(f"System RAM: {round(psutil.virtual_memory().total / 1024**3, 2)} GB")

    model_name = "Qwen/Qwen3-4B"
    log(f"Model: {model_name}")

    mem_before = get_gpu_mem()
    log(f"GPU before model: allocated={mem_before['allocated_MB']} MB")

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    log("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    log("Tokenizer loaded.")

    log("Loading model in 4-bit...")
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        trust_remote_code=True,
        quantization_config=bnb_config,
        device_map="cuda",
        dtype=torch.float16,
    )
    mem_after_model = get_gpu_mem()
    log(f"Model loaded. GPU: allocated={mem_after_model['allocated_MB']} MB, reserved={mem_after_model['reserved_MB']} MB")

    log("Preparing for k-bit training...")
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=False)

    log("Attaching LoRA...")
    lora_config = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    model = get_peft_model(model, lora_config)
    model.train()
    mem_after_lora = get_gpu_mem()
    log(f"LoRA attached. GPU: allocated={mem_after_lora['allocated_MB']} MB, reserved={mem_after_lora['reserved_MB']} MB")

    trainable_params, total_params = model.get_nb_trainable_parameters()
    log(f"Trainable: {trainable_params:,} / Total: {total_params:,}")

    # Load one example
    log("Loading one training example...")
    dataset_dir = os.path.join(BASE_DIR, "datasets", "arcon_v1")
    train_path = os.path.join(dataset_dir, "train.jsonl")
    with open(train_path, "r", encoding="utf-8") as f:
        line = f.readline().strip()
    example = json.loads(line)
    text = tokenizer.apply_chat_template(example["messages"], tokenize=False, add_generation_prompt=False)
    log(f"Example text length: {len(text)}")

    encoded = tokenizer(text, truncation=True, max_length=128, return_tensors="pt")
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

    # Save adapter
    adapter_path = os.path.join(OUTPUT_DIR, "adapter")
    log(f"Saving adapter to {adapter_path}...")
    model.save_pretrained(adapter_path)
    log(f"Adapter saved: {os.path.isdir(adapter_path)}")
    files = os.listdir(adapter_path) if os.path.isdir(adapter_path) else []
    log(f"Adapter files: {files}")

    # Smoke test
    log("Running smoke test...")
    model.eval()
    test_messages = [{"role": "user", "content": "Who are you?"}]
    test_text = tokenizer.apply_chat_template(test_messages, tokenize=False, add_generation_prompt=True)
    test_inputs = tokenizer([test_text], return_tensors="pt").to("cuda")
    with torch.no_grad():
        out = model.generate(**test_inputs, max_new_tokens=64, temperature=0.7, top_p=0.9, repetition_penalty=1.1, do_sample=True, pad_token_id=tokenizer.eos_token_id)
    response = tokenizer.decode(out[0][test_inputs.input_ids.shape[1]:], skip_special_tokens=True)
    log(f"Response: {response[:200]}")

    log("=" * 60)
    log("MINIMAL TRAINING PASSED")
    log("=" * 60)
    log("Ready for full Training V1.")

if __name__ == "__main__":
    main()
