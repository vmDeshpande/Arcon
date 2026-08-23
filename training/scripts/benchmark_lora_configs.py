import os
import gc
import time
import json
import torch
import psutil
from datetime import datetime
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


MODEL_NAME = "Qwen/Qwen3-4B"

CONFIGS = {
    "A": {
        "name": "Attention only",
        "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj"],
        "r": 8,
        "alpha": 16,
        "dropout": 0.05,
    },
    "B": {
        "name": "Attention + MLP",
        "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        "r": 8,
        "alpha": 16,
        "dropout": 0.05,
    },
    "C": {
        "name": "Lower-rank full",
        "target_modules": ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        "r": 4,
        "alpha": 8,
        "dropout": 0.05,
    },
}

SEQ_LENGTHS = [128, 256, 512]

TOTAL_VRAM_GB = round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 2) if torch.cuda.is_available() else 0.0


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


def clear_cuda():
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()
        torch.cuda.reset_accumulated_memory_stats()


def build_dataset(tokenizer, max_length):
    raw_examples = [
        "User: Hello\nAssistant: Hello. I'm Arcon.",
        "User: What is your name?\nAssistant: My name is Arcon.",
        "User: What are you?\nAssistant: I'm an AI companion being developed to understand, remember, and grow through conversation.",
        "User: Do you have feelings?\nAssistant: I process emotional context and can reflect it, though my experience of emotion is different from human feeling.",
        "User: Tell me about yourself.\nAssistant: I am Arcon, a persistent AI companion designed for long-term interaction and memory.",
    ]

    def tokenize_fn(example):
        tokenized = tokenizer(
            example,
            padding="max_length",
            truncation=True,
            max_length=max_length,
            return_tensors=None,
        )
        tokenized["labels"] = tokenized["input_ids"][:]
        return tokenized

    dataset = Dataset.from_list([{"text": ex} for ex in raw_examples])
    dataset = dataset.map(lambda x: tokenize_fn(x["text"]), batched=False, remove_columns=["text"])
    return dataset


def load_tokenizer():
    tokenizer = AutoTokenizer.from_pretrained(
        MODEL_NAME,
        trust_remote_code=True,
        use_fast=True,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    return tokenizer


def load_model():
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        trust_remote_code=True,
        quantization_config=bnb_config,
        device_map="cuda",
        dtype=torch.float16,
    )
    return model


def run_benchmark(config_key, config, seq_length, tokenizer):
    label = f"Config {config_key} | Seq {seq_length}"
    log(f"=== START {label} ===")
    result = {
        "config": config_key,
        "config_name": config["name"],
        "target_modules": config["target_modules"],
        "r": config["r"],
        "alpha": config["alpha"],
        "dropout": config["dropout"],
        "seq_length": seq_length,
        "trainable_params": None,
        "total_params": None,
        "model_allocated_MB": None,
        "model_reserved_MB": None,
        "lora_allocated_MB": None,
        "lora_reserved_MB": None,
        "peak_allocated_MB": None,
        "peak_reserved_MB": None,
        "step_time_s": None,
        "oom": False,
        "error": None,
        "result": "FAIL",
    }

    try:
        mem_before = get_gpu_mem()
        result["model_allocated_MB"] = mem_before["allocated_MB"]
        result["model_reserved_MB"] = mem_before["reserved_MB"]

        model = load_model()
        mem_after_model = get_gpu_mem()
        result["model_allocated_MB"] = mem_after_model["allocated_MB"]
        result["model_reserved_MB"] = mem_after_model["reserved_MB"]

        model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=False)

        lora_config = LoraConfig(
            r=config["r"],
            lora_alpha=config["alpha"],
            lora_dropout=config["dropout"],
            bias="none",
            task_type="CAUSAL_LM",
            target_modules=config["target_modules"],
        )
        model = get_peft_model(model, lora_config)

        mem_after_lora = get_gpu_mem()
        result["lora_allocated_MB"] = mem_after_lora["allocated_MB"]
        result["lora_reserved_MB"] = mem_after_lora["reserved_MB"]

        trainable_params, total_params = model.get_nb_trainable_parameters()
        result["trainable_params"] = trainable_params
        result["total_params"] = total_params

        dataset = build_dataset(tokenizer, seq_length)

        optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
        model.train()

        clear_cuda()
        torch.cuda.reset_peak_memory_stats()

        batch = dataset[0]
        input_ids = torch.tensor([batch["input_ids"]], dtype=torch.long, device="cuda")
        attention_mask = torch.tensor([batch["attention_mask"]], dtype=torch.long, device="cuda")
        labels = torch.tensor([batch["labels"]], dtype=torch.long, device="cuda")

        step_start = time.time()
        optimizer.zero_grad()
        outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)
        loss = outputs.loss
        loss.backward()
        optimizer.step()
        step_time = time.time() - step_start

        mem_after_step = get_gpu_mem()
        result["peak_allocated_MB"] = mem_after_step["max_allocated_MB"]
        result["peak_reserved_MB"] = mem_after_step["reserved_MB"]
        result["step_time_s"] = round(step_time, 2)
        result["result"] = "PASS" if loss.item() == loss.item() else "FAIL"

        del model, optimizer, outputs, loss, input_ids, attention_mask, labels, batch, dataset
        clear_cuda()

    except RuntimeError as e:
        msg = str(e).lower()
        if "out of memory" in msg or "cuda" in msg:
            result["oom"] = True
            result["error"] = str(e)
            result["result"] = "OOM"
            log(f"OOM in {label}: {e}")
        else:
            result["error"] = str(e)
            result["result"] = "ERROR"
            log(f"ERROR in {label}: {e}")
        clear_cuda()
    except Exception as e:
        result["error"] = str(e)
        result["result"] = "ERROR"
        log(f"ERROR in {label}: {e}")
        clear_cuda()

    log(f"=== END {label} => {result['result']} ===")
    return result


def main():
    output_dir = os.path.join("training", "outputs", "test")
    os.makedirs(output_dir, exist_ok=True)
    report_path = os.path.join(output_dir, "lora-config-benchmark.txt")

    lines = []
    def rprint(msg=""):
        print(msg)
        lines.append(str(msg))

    rprint("# LoRA Configuration Benchmark Report")
    rprint(f"Generated: {datetime.now().isoformat()}")
    rprint(f"Model: {MODEL_NAME}")
    rprint(f"Quantization: 4-bit NF4 + double quantization + float16 compute")
    rprint(f"GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU")
    rprint(f"Total VRAM: {TOTAL_VRAM_GB} GB")
    rprint()

    tokenizer = load_tokenizer()

    results = []
    for config_key in ["A", "B", "C"]:
        config = CONFIGS[config_key]
        for seq_length in SEQ_LENGTHS:
            res = run_benchmark(config_key, config, seq_length, tokenizer)
            results.append(res)
            # Stop early if OOM on a smaller sequence length for the same config,
            # because larger seq will also OOM.
            if res["oom"] and seq_length < 512:
                log(f"Skipping larger sequence lengths for Config {config_key} due to OOM.")
                break

    # Print summary table
    rprint("## Benchmark Summary")
    header = "| Config | Target Modules | r | alpha | Seq | Trainable Params | Peak VRAM (allocated) | Peak VRAM (reserved) | Step Time | Result |"
    separator = "|--------|-----------------|---|-------|-----|------------------|----------------------|----------------------|-----------|--------|"
    rprint(header)
    rprint(separator)
    for res in results:
        modules = "+".join([m.replace("_proj", "") for m in res["target_modules"]])
        trainable = f"{res['trainable_params']:,}" if res['trainable_params'] is not None else "N/A"
        peak_alloc = f"{res['peak_allocated_MB']} MB" if res['peak_allocated_MB'] is not None else "N/A"
        peak_res = f"{res['peak_reserved_MB']} MB" if res['peak_reserved_MB'] is not None else "N/A"
        step_time = f"{res['step_time_s']}s" if res['step_time_s'] is not None else "N/A"
        error_note = f" ({res['error']})" if res['error'] else ""
        rprint(f"| {res['config']} | {modules} | {res['r']} | {res['alpha']} | {res['seq_length']} | {trainable} | {peak_alloc} | {peak_res} | {step_time} | {res['result']}{error_note} |")
    rprint()

    # Recommendations
    rprint("## Recommendation")
    passed_results = [r for r in results if r["result"] == "PASS"]
    if not passed_results:
        rprint("No configuration completed successfully. Review errors above.")
    else:
        # Find config with lowest peak VRAM among passed
        best_mem = min(passed_results, key=lambda x: x["peak_allocated_MB"] or float('inf'))
        # Find config with fastest step time among passed
        best_speed = min(passed_results, key=lambda x: x["step_time_s"] or float('inf'))
        # Find config with highest trainable params among passed
        best_capacity = max(passed_results, key=lambda x: x["trainable_params"] or 0)

        rprint(f"- Lowest peak VRAM: Config {best_mem['config']} ({best_mem['config_name']}) at seq {best_mem['seq_length']} -> {best_mem['peak_allocated_MB']} MB")
        rprint(f"- Fastest step time: Config {best_speed['config']} ({best_speed['config_name']}) at seq {best_speed['seq_length']} -> {best_speed['step_time_s']}s")
        rprint(f"- Highest trainable params: Config {best_capacity['config']} ({best_capacity['config_name']}) at seq {best_capacity['seq_length']} -> {best_capacity['trainable_params']:,}")

        # Practical recommendation
        # Config B at r=8 seems to be the balanced choice based on the feasibility test.
        # We want at least 128 tokens, ideally 256.
        b_results = [r for r in passed_results if r["config"] == "B"]
        if b_results:
            b_128 = next((r for r in b_results if r["seq_length"] == 128), None)
            b_256 = next((r for r in b_results if r["seq_length"] == 256), None)
            if b_256:
                rec = f"Config B (r=8) at sequence length 256. Peak VRAM ~{b_256['peak_allocated_MB']} MB with {b_256['trainable_params']:,} trainable parameters."
            elif b_128:
                rec = f"Config B (r=8) at sequence length 128. Peak VRAM ~{b_128['peak_allocated_MB']} MB with {b_128['trainable_params']:,} trainable parameters."
            else:
                rec = "Config B (r=8) at the largest passing sequence length."
            rprint(f"- Recommended for first Arcon training: {rec}")
        else:
            rprint("- Recommended for first Arcon training: Config B (r=8) at sequence length 128, based on prior feasibility test.")

    rprint()
    rprint("## Raw Results")
    rprint("```json")
    rprint(json.dumps(results, indent=2))
    rprint("```")
    rprint()

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    log(f"Report saved to {report_path}")


if __name__ == "__main__":
    main()
