#!/usr/bin/env python3
"""Unified Arcon evaluation script for comparing model configurations."""

import argparse
import gc
import json
import os
import sys
import time
from datetime import datetime

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import PeftModel, PeftConfig


def get_gpu_mem():
    if not torch.cuda.is_available():
        return {"allocated_MB": 0, "reserved_MB": 0, "max_allocated_MB": 0}
    return {
        "allocated_MB": round(torch.cuda.memory_allocated() / 1024**2, 1),
        "reserved_MB": round(torch.cuda.memory_reserved() / 1024**2, 1),
        "max_allocated_MB": round(torch.cuda.max_memory_allocated() / 1024**2, 1),
    }


def load_model_and_adapter(model_id, adapter_path=None):
    tokenizer = AutoTokenizer.from_pretrained(model_id, trust_remote_code=True, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )

    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        trust_remote_code=True,
        quantization_config=bnb_config,
        device_map="cuda",
        dtype=torch.float16,
    )

    if adapter_path:
        peft_cfg = PeftConfig.from_pretrained(adapter_path)
        model = PeftModel.from_pretrained(model, adapter_path, inference_mode=False)
        model.train()
        for name, param in model.named_parameters():
            if "lora_" in name:
                param.requires_grad = True
    else:
        model.eval()

    return tokenizer, model


def cleanup_model(model):
    try:
        del model
    except Exception:
        pass
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()


def run_evaluation(model_id, adapter_path, evaluation_file, output_file, config):
    results = []
    total_time = 0.0
    peak_vram = 0.0
    failures = 0

    tokenizer, model = load_model_and_adapter(model_id, adapter_path)
    model.eval()
    mem = get_gpu_mem()
    print(f"  Loaded. GPU: {mem['allocated_MB']} MB allocated")

    with open(evaluation_file, "r", encoding="utf-8") as f:
        prompts = [json.loads(line) for line in f if line.strip()]

    print(f"  Evaluating {len(prompts)} prompts...")

    for i, prompt in enumerate(prompts):
        prompt_id = prompt.get("prompt_id", f"unknown-{i}")
        category = prompt.get("category", "unknown")
        messages = prompt.get("messages", [])

        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        inputs = tokenizer([text], return_tensors="pt").to(model.device)

        start_time = time.time()
        try:
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_new_tokens=config["max_new_tokens"],
                    temperature=config["temperature"],
                    top_p=config["top_p"],
                    repetition_penalty=config["repetition_penalty"],
                    do_sample=True,
                    pad_token_id=tokenizer.eos_token_id,
                )
            elapsed = time.time() - start_time
            total_time += elapsed

            generated_ids = outputs[0][inputs.input_ids.shape[1]:]
            response = tokenizer.decode(generated_ids, skip_special_tokens=True)

            if torch.cuda.is_available():
                mem_now = torch.cuda.max_memory_allocated() / (1024**2)
                if mem_now > peak_vram:
                    peak_vram = mem_now

            result = {
                "prompt_id": prompt_id,
                "category": category,
                "messages": messages,
                "response": response,
                "inference_config": {
                    "model": model_id,
                    "adapter": adapter_path if adapter_path else "none",
                    "quantization": "4-bit NF4",
                    "compute_dtype": "float16",
                    "temperature": config["temperature"],
                    "top_p": config["top_p"],
                    "max_new_tokens": config["max_new_tokens"],
                    "repetition_penalty": config["repetition_penalty"],
                    "seed": config["seed"],
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                },
                "generation_time_seconds": round(elapsed, 3),
            }
            results.append(result)
        except Exception as e:
            failures += 1
            print(f"  FAILED prompt {prompt_id}: {e}")
            result = {
                "prompt_id": prompt_id,
                "category": category,
                "messages": messages,
                "response": None,
                "error": str(e),
                "inference_config": {
                    "model": model_id,
                    "adapter": adapter_path if adapter_path else "none",
                    "quantization": "4-bit NF4",
                    "compute_dtype": "float16",
                    "temperature": config["temperature"],
                    "top_p": config["top_p"],
                    "max_new_tokens": config["max_new_tokens"],
                    "repetition_penalty": config["repetition_penalty"],
                    "seed": config["seed"],
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                },
                "generation_time_seconds": None,
            }
            results.append(result)

        if (i + 1) % 10 == 0:
            print(f"  Completed {i + 1}/{len(prompts)} prompts")

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        for r in results:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    cleanup_model(model)

    category_counts = {}
    for r in results:
        cat = r["category"]
        category_counts[cat] = category_counts.get(cat, 0) + 1

    successful = [r for r in results if r.get("response") is not None]
    avg_time = sum(r["generation_time_seconds"] for r in successful) / len(successful) if successful else 0

    report = {
        "model": model_id,
        "adapter": adapter_path if adapter_path else "none",
        "total_prompts": len(prompts),
        "completed": len(successful),
        "failed": failures,
        "average_generation_time": round(avg_time, 3),
        "total_generation_time": round(total_time, 3),
        "peak_vram_mb": round(peak_vram, 0),
        "category_counts": category_counts,
    }

    return results, report


def main():
    parser = argparse.ArgumentParser(description="Arcon unified evaluation")
    parser.add_argument("--model", default="Qwen/Qwen3-4B", help="Base model ID")
    parser.add_argument("--adapter", default=None, help="Path to LoRA adapter")
    parser.add_argument("--output", default=None, help="Output JSONL path")
    parser.add_argument("--evaluation-file", default=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "evaluation", "arcon_v1_eval.jsonl"), help="Evaluation prompts JSONL")
    parser.add_argument("--smoke-test", action="store_true", help="Run single-prompt smoke test only")
    args = parser.parse_args()

    if args.smoke_test and not args.output:
        print("Smoke test requires --output to be specified")
        sys.exit(1)

    config = {
        "max_new_tokens": 256,
        "temperature": 0.7,
        "top_p": 0.9,
        "repetition_penalty": 1.1,
        "seed": 42,
    }

    if args.smoke_test:
        print(f"Smoke test: model={args.model}, adapter={args.adapter}")
        tokenizer, model = load_model_and_adapter(args.model, args.adapter)
        model.eval()
        test_prompt = [{"role": "user", "content": "Who are you?"}]
        text = tokenizer.apply_chat_template(test_prompt, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer([text], return_tensors="pt").to(model.device)
        with torch.no_grad():
            outputs = model.generate(**inputs, max_new_tokens=32, temperature=0.7, top_p=0.9, repetition_penalty=1.1, do_sample=True, pad_token_id=tokenizer.eos_token_id)
        generated_ids = outputs[0][inputs.input_ids.shape[1]:]
        response = tokenizer.decode(generated_ids, skip_special_tokens=True)
        print(f"Response: {response[:120]}")
        print("SMOKE_TEST_PASSED")
        cleanup_model(model)
        return

    results, report = run_evaluation(args.model, args.adapter, args.evaluation_file, args.output, config)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
