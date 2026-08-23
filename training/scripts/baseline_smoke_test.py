#!/usr/bin/env python3
"""2-prompt smoke test for Qwen3-4B baseline evaluation."""

import json
import os
import time
import torch
from datetime import datetime
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVAL_PROMPTS_PATH = os.path.join(BASE_DIR, "evaluation", "arcon_v1_eval.jsonl")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs", "baseline")
os.makedirs(OUTPUT_DIR, exist_ok=True)

SMOKE_OUTPUT_PATH = os.path.join(OUTPUT_DIR, "smoke-test.jsonl")

MODEL_ID = "Qwen/Qwen3-4B"
MAX_NEW_TOKENS = 256
TEMPERATURE = 0.7
TOP_P = 0.9
REPETITION_PENALTY = 1.1
SEED = 42

torch.manual_seed(SEED)

print("=" * 60)
print("Qwen3-4B Baseline Smoke Test")
print("=" * 60)
print(f"Model: {MODEL_ID}")
print(f"Quantization: 4-bit NF4 with double quantization")
print(f"Compute dtype: float16")
print(f"Device map: cuda")
print(f"Seed: {SEED}")
print()

# Load tokenizer
print("[1/6] Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)
print(f"  Tokenizer loaded: {type(tokenizer).__name__}")

# Configure 4-bit quantization
print("[2/6] Configuring 4-bit quantization...")
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)
print("  BitsAndBytesConfig: 4-bit NF4, double quant, float16 compute")

# Load model
print("[3/6] Loading model in 4-bit...")
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    trust_remote_code=True,
    quantization_config=bnb_config,
    device_map="cuda",
    dtype=torch.float16,
)
model.eval()
print("  Model loaded and set to eval mode")

# Check GPU memory
print("[4/6] Checking GPU memory...")
if torch.cuda.is_available():
    allocated = torch.cuda.memory_allocated() / (1024 ** 2)
    reserved = torch.cuda.memory_reserved() / (1024 ** 2)
    max_allocated = torch.cuda.max_memory_allocated() / (1024 ** 2)
    print(f"  GPU: {torch.cuda.get_device_name(0)}")
    print(f"  Allocated: {allocated:.1f} MB")
    print(f"  Reserved: {reserved:.1f} MB")
    print(f"  Max allocated: {max_allocated:.1f} MB")
else:
    print("  WARNING: CUDA not available")

# Load first 2 prompts
print("[5/6] Loading first 2 prompts...")
prompts = []
with open(EVAL_PROMPTS_PATH, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line:
            prompts.append(json.loads(line))
prompts = prompts[:2]
print(f"  Loaded {len(prompts)} prompts for smoke test")

# Generate responses
print("[6/6] Running generation...")
results = []
total_time = 0.0

for i, prompt in enumerate(prompts):
    prompt_id = prompt["prompt_id"]
    category = prompt["category"]
    messages = prompt["messages"]

    text = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )

    inputs = tokenizer([text], return_tensors="pt").to(model.device)

    start_time = time.time()
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=MAX_NEW_TOKENS,
            temperature=TEMPERATURE,
            top_p=TOP_P,
            repetition_penalty=REPETITION_PENALTY,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    elapsed = time.time() - start_time
    total_time += elapsed

    generated_ids = outputs[0][inputs.input_ids.shape[1]:]
    response = tokenizer.decode(generated_ids, skip_special_tokens=True)

    result = {
        "prompt_id": prompt_id,
        "category": category,
        "messages": messages,
        "response": response,
        "inference_config": {
            "model": MODEL_ID,
            "quantization": "4-bit NF4",
            "compute_dtype": "float16",
            "temperature": TEMPERATURE,
            "top_p": TOP_P,
            "max_new_tokens": MAX_NEW_TOKENS,
            "repetition_penalty": REPETITION_PENALTY,
            "seed": SEED,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        },
        "generation_time_seconds": round(elapsed, 3),
    }
    results.append(result)
    print(f"  Prompt {i+1}/2: {prompt_id} | {elapsed:.2f}s | {len(response)} chars")

# Save smoke test results
with open(SMOKE_OUTPUT_PATH, "w", encoding="utf-8") as f:
    for r in results:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"  Smoke test results saved to {SMOKE_OUTPUT_PATH}")

print()
print("=" * 60)
print("SMOKE TEST PASSED")
print("=" * 60)
print(f"Prompts tested: {len(results)}")
print(f"Total time: {total_time:.2f}s")
print(f"Average time: {total_time/len(results):.2f}s")
print()
print("Loading configuration:")
print("  Model: Qwen/Qwen3-4B")
print("  Quantization: 4-bit NF4 with double quantization")
print("  Compute dtype: float16")
print("  Device map: cuda")
print("  LoRA adapter: NONE (baseline)")
print()
print("Ready to run full 100-prompt baseline evaluation.")
