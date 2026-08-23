#!/usr/bin/env python3
"""Baseline evaluation of Qwen/Qwen3-4B for Arcon."""

import json
import os
import time
from datetime import datetime

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVAL_PROMPTS_PATH = os.path.join(BASE_DIR, "evaluation", "arcon_v1_eval.jsonl")
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs", "baseline")
os.makedirs(OUTPUT_DIR, exist_ok=True)

BASELINE_OUTPUT_PATH = os.path.join(OUTPUT_DIR, "qwen3-4b-baseline.jsonl")
BASELINE_REPORT_PATH = os.path.join(OUTPUT_DIR, "qwen3-4b-baseline-report.md")

MODEL_ID = "Qwen/Qwen3-4B"
MAX_NEW_TOKENS = 256
TEMPERATURE = 0.7
TOP_P = 0.9
REPETITION_PENALTY = 1.1
SEED = 42

torch.manual_seed(SEED)

print("Loading tokenizer...")
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)

print("Configuring 4-bit quantization...")
bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

print("Loading model in 4-bit...")
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    trust_remote_code=True,
    quantization_config=bnb_config,
    device_map="cuda",
    dtype=torch.float16,
)
model.eval()
print("Model loaded.")

# Load prompts
prompts = []
with open(EVAL_PROMPTS_PATH, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line:
            prompts.append(json.loads(line))

print(f"Loaded {len(prompts)} prompts")

results = []
total_time = 0.0
peak_vram = 0.0

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

    if torch.cuda.is_available():
        mem = torch.cuda.max_memory_allocated() / (1024 ** 2)
        if mem > peak_vram:
            peak_vram = mem

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

    if (i + 1) % 10 == 0:
        print(f"  Completed {i + 1}/{len(prompts)} prompts")

# Save results
with open(BASELINE_OUTPUT_PATH, "w", encoding="utf-8") as f:
    for r in results:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

print(f"Saved baseline results to {BASELINE_OUTPUT_PATH}")

# Generate report
categories = {}
for r in results:
    cat = r["category"]
    categories[cat] = categories.get(cat, 0) + 1

avg_time = total_time / len(results) if results else 0

report = f"""# Qwen3-4B Arcon Baseline

## Environment

Python: 3.10+
PyTorch: {torch.__version__}
CUDA: {torch.version.cuda if torch.cuda.is_available() else 'N/A'}
GPU: NVIDIA GeForce RTX 3050 6GB
VRAM: 6144 MiB

## Model

Model: {MODEL_ID}
Quantization: 4-bit NF4
Compute dtype: float16

## Evaluation

Total prompts: {len(results)}
Identity: {categories.get('identity', 0)}
Cognition: {categories.get('cognition', 0)}
Emotion: {categories.get('emotion', 0)}
Memory: {categories.get('memory', 0)}
Curiosity: {categories.get('curiosity', 0)}
Personality: {categories.get('personality', 0)}
Anomalies: {categories.get('anomalies', 0)}
General capability: {categories.get('general_capability', 0)}
Multi-turn: {categories.get('multi_turn', 0)}

## Performance

Average generation time: {avg_time:.2f}s
Total evaluation time: {total_time:.2f}s
Peak VRAM: {peak_vram:.0f} MB

## Behavioral observations

Baseline evaluation completed on vanilla Qwen3-4B without Arcon training or LoRA adapter.

## Important baseline behaviors

See training/outputs/baseline/qwen3-4b-baseline.jsonl for detailed per-prompt responses.

## Result

BASELINE_COMPLETE
"""

with open(BASELINE_REPORT_PATH, "w", encoding="utf-8") as f:
    f.write(report)

print(f"Saved baseline report to {BASELINE_REPORT_PATH}")
print("Baseline evaluation complete.")
