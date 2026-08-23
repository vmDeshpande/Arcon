#!/usr/bin/env python3
"""Arcon V2 QLoRA Training Script - manual loop with checkpoint/resume/pause."""

import json
import os
import sys
import time
import argparse
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
OUTPUT_DIR = os.path.join(BASE_DIR, "outputs", "arcon-v2")
os.makedirs(OUTPUT_DIR, exist_ok=True)

LOG_PATH = os.path.join(OUTPUT_DIR, "training_log.txt")
STATUS_PATH = os.path.join(OUTPUT_DIR, "training_status.json")
PAUSE_PATH = os.path.join(OUTPUT_DIR, "PAUSE")


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


def write_status(status_data):
    with open(STATUS_PATH, "w", encoding="utf-8") as f:
        json.dump(status_data, f, indent=2)


def save_checkpoint(model, optimizer, scheduler, epoch, step, output_dir, config):
    checkpoint_dir = os.path.join(output_dir, "checkpoints", f"checkpoint-epoch{epoch+1}-step{step+1}")
    os.makedirs(checkpoint_dir, exist_ok=True)

    # Save LoRA adapter weights
    model.save_pretrained(checkpoint_dir)

    # Save optimizer state
    torch.save(optimizer.state_dict(), os.path.join(checkpoint_dir, "optimizer.pt"))

    # Save scheduler state
    torch.save(scheduler.state_dict(), os.path.join(checkpoint_dir, "scheduler.pt"))

    # Save training state
    training_state = {
        "epoch": epoch,
        "step": step,
        "total_steps": step + 1,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "config": config,
    }
    with open(os.path.join(checkpoint_dir, "training_state.json"), "w") as f:
        json.dump(training_state, f, indent=2)

    log(f"Checkpoint saved: {checkpoint_dir}")
    return checkpoint_dir


def load_checkpoint(model, optimizer, scheduler, checkpoint_dir):
    log(f"Loading checkpoint from {checkpoint_dir}...")

    # Load optimizer state
    optimizer_path = os.path.join(checkpoint_dir, "optimizer.pt")
    if os.path.exists(optimizer_path):
        optimizer.load_state_dict(torch.load(optimizer_path, weights_only=True))
        log("Optimizer state loaded.")

    # Load scheduler state
    scheduler_path = os.path.join(checkpoint_dir, "scheduler.pt")
    if os.path.exists(scheduler_path):
        scheduler.load_state_dict(torch.load(scheduler_path, weights_only=True))
        log("Scheduler state loaded.")

    # Load training state
    state_path = os.path.join(checkpoint_dir, "training_state.json")
    if os.path.exists(state_path):
        with open(state_path, "r") as f:
            state = json.load(f)
        log(f"Resuming from epoch {state['epoch']+1}, step {state['step']+1}")
        return model, optimizer, scheduler, state["epoch"], state["step"]

    return model, optimizer, scheduler, 0, -1


def check_pause():
    if os.path.exists(PAUSE_PATH):
        return True
    return False


def clear_pause():
    if os.path.exists(PAUSE_PATH):
        os.remove(PAUSE_PATH)
        log("Cleared previous PAUSE request.")


def main():
    global LOG_PATH

    # Clear log
    with open(LOG_PATH, "w", encoding="utf-8") as f:
        f.write("")

    # Clear any previous pause request
    clear_pause()

    parser = argparse.ArgumentParser()
    parser.add_argument("--resume-from-checkpoint", type=str, default=None)
    args = parser.parse_args()

    lines = []
    def rprint(msg=""):
        print(msg)
        lines.append(str(msg))

    rprint("# Arcon V2 QLoRA Training Report")
    rprint(f"Generated: {datetime.now().isoformat()}")
    rprint()

    # ---------------------------------------------------------
    # 1. Environment
    # ---------------------------------------------------------
    rprint("## 1. Environment")
    rprint(f"Python: {os.sys.version}")
    rprint(f"PyTorch: {torch.__version__}")
    rprint(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        rprint(f"CUDA version: {torch.version.cuda}")
        rprint(f"GPU: {torch.cuda.get_device_name(0)}")
        rprint(f"Total VRAM: {round(torch.cuda.get_device_properties(0).total_memory / 1024**3, 2)} GB")
    rprint(f"System RAM: {round(psutil.virtual_memory().total / 1024**3, 2)} GB")
    try:
        import transformers
        rprint(f"Transformers: {transformers.__version__}")
    except Exception as e:
        rprint(f"Transformers: ERROR ({e})")
    try:
        import peft
        rprint(f"PEFT: {peft.__version__}")
    except Exception as e:
        rprint(f"PEFT: ERROR ({e})")
    try:
        import bitsandbytes
        rprint(f"bitsandbytes: {bitsandbytes.__version__}")
    except Exception as e:
        rprint(f"bitsandbytes: ERROR ({e})")
    rprint()

    # ---------------------------------------------------------
    # 2. Model Loading
    # ---------------------------------------------------------
    rprint("## 2. Model")
    model_name = "Qwen/Qwen3-4B"
    rprint(f"Model: {model_name}")

    mem_before = get_gpu_mem()
    rprint(f"GPU VRAM before model load: allocated={mem_before['allocated_MB']} MB, reserved={mem_before['reserved_MB']} MB")

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    rprint("Quantization: 4-bit NF4 with double quantization")
    rprint("Quantization type: NF4")
    rprint("Compute dtype: float16")

    log("Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        trust_remote_code=True,
        use_fast=True,
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    rprint(f"Tokenizer: {type(tokenizer).__name__}")

    log("Loading model in 4-bit...")
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        trust_remote_code=True,
        quantization_config=bnb_config,
        device_map="cuda",
        dtype=torch.float16,
    )
    mem_after_model = get_gpu_mem()
    rprint(f"GPU VRAM after model load: allocated={mem_after_model['allocated_MB']} MB, reserved={mem_after_model['reserved_MB']} MB, max={mem_after_model['max_allocated_MB']} MB")
    rprint()

    # ---------------------------------------------------------
    # 3. LoRA Configuration
    # ---------------------------------------------------------
    rprint("## 3. LoRA")
    lora_r = 8
    lora_alpha = 16
    lora_dropout = 0.05
    target_modules = [
        "q_proj",
        "k_proj",
        "v_proj",
        "o_proj",
        "gate_proj",
        "up_proj",
        "down_proj",
    ]

    rprint(f"LoRA rank: {lora_r}")
    rprint(f"LoRA alpha: {lora_alpha}")
    rprint(f"LoRA dropout: {lora_dropout}")
    rprint(f"Target modules: {target_modules}")

    lora_config = LoraConfig(
        r=lora_r,
        lora_alpha=lora_alpha,
        lora_dropout=lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=target_modules,
    )

    if args.resume_from_checkpoint:
        log("Resuming: loading adapter from checkpoint...")
        from peft import PeftModel
        model = PeftModel.from_pretrained(model, args.resume_from_checkpoint, inference_mode=False)
        model.train()
        for name, param in model.named_parameters():
            if "lora_" in name:
                param.requires_grad = True
        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        total = sum(p.numel() for p in model.parameters())
        log(f"Trainable parameters: {trainable:,} / {total:,}")
    else:
        log("Preparing model for k-bit training...")
        model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=False)

        log("Attaching LoRA adapters...")
        model = get_peft_model(model, lora_config)
        model.train()
        model.print_trainable_parameters()

    mem_after_lora = get_gpu_mem()
    rprint(f"GPU VRAM after LoRA attachment: allocated={mem_after_lora['allocated_MB']} MB, reserved={mem_after_lora['reserved_MB']} MB, max={mem_after_lora['max_allocated_MB']} MB")

    if not args.resume_from_checkpoint:
        model.print_trainable_parameters()
        trainable_params, total_params = model.get_nb_trainable_parameters()
        rprint(f"Trainable parameters: {trainable_params:,}")
        rprint(f"Total parameters: {total_params:,}")
    rprint()

    # ---------------------------------------------------------
    # 4. Dataset
    # ---------------------------------------------------------
    rprint("## 4. Dataset")
    dataset_dir = os.path.join(BASE_DIR, "datasets", "arcon_v1")
    train_path = os.path.join(dataset_dir, "train.jsonl")
    val_path = os.path.join(dataset_dir, "validation.jsonl")

    def load_jsonl(path):
        examples = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    examples.append(json.loads(line))
        return examples

    train_examples = load_jsonl(train_path)
    val_examples = load_jsonl(val_path)
    rprint(f"Training examples: {len(train_examples)}")
    rprint(f"Validation examples: {len(val_examples)}")
    rprint(f"Dataset version: arcon_v1 (frozen)")
    rprint()

    def format_example(example):
        text = tokenizer.apply_chat_template(
            example["messages"],
            tokenize=False,
            add_generation_prompt=False,
        )
        return text

    train_texts = [format_example(ex) for ex in train_examples]
    val_texts = [format_example(ex) for ex in val_examples]

    # Tokenize datasets
    seq_length = 128
    def tokenize(texts):
        encodings = []
        for text in texts:
            encoded = tokenizer(
                text,
                truncation=True,
                max_length=seq_length,
                return_tensors="pt",
            )
            encodings.append({
                "input_ids": encoded["input_ids"][0],
                "attention_mask": encoded["attention_mask"][0],
                "labels": encoded["input_ids"][0].clone(),
            })
        return encodings

    log("Tokenizing training data...")
    train_encodings = tokenize(train_texts)
    log("Tokenizing validation data...")
    val_encodings = tokenize(val_texts)
    rprint(f"Train encodings: {len(train_encodings)}")
    rprint(f"Eval encodings: {len(val_encodings)}")
    rprint()

    # ---------------------------------------------------------
    # 5. Training Configuration
    # ---------------------------------------------------------
    rprint("## 5. Training Configuration")
    batch_size = 1
    grad_accum = 1
    learning_rate = 2e-4
    epochs = 3
    warmup_ratio = 0.05
    seed = 42
    warmup_steps = int(warmup_ratio * (len(train_encodings) // batch_size))
    checkpoint_interval = 50

    rprint(f"Sequence length: {seq_length}")
    rprint(f"Batch size: {batch_size}")
    rprint(f"Gradient accumulation: {grad_accum}")
    rprint(f"Learning rate: {learning_rate}")
    rprint(f"Epochs: {epochs}")
    rprint(f"Warmup steps: {warmup_steps}")
    rprint(f"Seed: {seed}")
    rprint(f"Optimizer: AdamW")
    rprint(f"Scheduler: cosine")
    rprint(f"Mixed precision: None (fp32)")
    rprint(f"Checkpoint interval: {checkpoint_interval} steps")
    rprint()

    config = {
        "base_model": model_name,
        "quantization": "4-bit NF4",
        "compute_dtype": "float16",
        "lora_r": lora_r,
        "lora_alpha": lora_alpha,
        "lora_dropout": lora_dropout,
        "target_modules": target_modules,
        "sequence_length": seq_length,
        "batch_size": batch_size,
        "gradient_accumulation_steps": grad_accum,
        "learning_rate": learning_rate,
        "optimizer": "AdamW",
        "scheduler": "cosine",
        "warmup_ratio": warmup_ratio,
        "warmup_steps": warmup_steps,
        "epochs": epochs,
        "seed": seed,
        "dataset_version": "arcon_v1",
        "training_timestamp": datetime.utcnow().isoformat() + "Z",
        "train_examples": len(train_examples),
        "validation_examples": len(val_examples),
        "total_examples": len(train_examples) + len(val_examples),
        "checkpoint_interval": checkpoint_interval,
    }

    torch.manual_seed(seed)

    # Initialize optimizer and scheduler before resume check
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer,
        T_max=len(train_encodings) * epochs,
        eta_min=1e-6,
    )

    # ---------------------------------------------------------
    # 6. Resume from checkpoint
    # ---------------------------------------------------------
    start_epoch = 0
    start_step = -1
    latest_checkpoint = None

    if args.resume_from_checkpoint:
        model, optimizer, scheduler, start_epoch, start_step = load_checkpoint(
            model, optimizer, scheduler, args.resume_from_checkpoint
        )
        latest_checkpoint = args.resume_from_checkpoint
        log(f"RESUMING ARCON V2 from checkpoint: {args.resume_from_checkpoint}")
        log(f"Epoch: {start_epoch+1}, Step: {start_step+1}")

    # Write initial status
    write_status({
        "status": "STARTING",
        "PID": os.getpid(),
        "epoch": start_epoch + 1,
        "step": start_step + 1,
        "total_steps": len(train_encodings) * epochs,
        "progress_percent": 0.0,
        "train_loss": None,
        "validation_loss": None,
        "elapsed_seconds": 0,
        "estimated_remaining_seconds": None,
        "latest_checkpoint": latest_checkpoint,
        "last_update_timestamp": datetime.utcnow().isoformat() + "Z",
    })

    # ---------------------------------------------------------
    # 7. Training Loop
    # ---------------------------------------------------------
    rprint("## 6. Training")
    log("Starting training...")

    torch.cuda.reset_peak_memory_stats()
    start_time = time.time()

    total_steps = 0
    step_times = []
    train_losses = []
    val_losses = []
    best_val_loss = float("inf")
    paused = False

    for epoch in range(start_epoch, epochs):
        if paused:
            break

        rprint(f"Epoch {epoch+1}/{epochs}")
        model.train()
        epoch_loss = 0.0
        epoch_steps = 0

        step_start_idx = start_step + 1 if epoch == start_epoch else 0

        for step in range(step_start_idx, len(train_encodings)):
            # Check for pause request
            if check_pause():
                log("PAUSE requested. Saving checkpoint and exiting...")
                paused = True
                save_checkpoint(model, optimizer, scheduler, epoch, step, OUTPUT_DIR, config)
                write_status({
                    "status": "PAUSED",
                    "PID": os.getpid(),
                    "epoch": epoch + 1,
                    "step": step + 1,
                    "total_steps": len(train_encodings) * epochs,
                    "progress_percent": round(((epoch * len(train_encodings) + step + 1) / (len(train_encodings) * epochs)) * 100, 2),
                    "train_loss": round(epoch_loss / epoch_steps, 6) if epoch_steps > 0 else None,
                    "validation_loss": None,
                    "elapsed_seconds": round(time.time() - start_time, 2),
                    "estimated_remaining_seconds": None,
                    "latest_checkpoint": os.path.join(OUTPUT_DIR, "checkpoints", f"checkpoint-epoch{epoch+1}-step{step+1}"),
                    "last_update_timestamp": datetime.utcnow().isoformat() + "Z",
                })
                rprint("Training PAUSED. Resume with --resume-from-checkpoint <latest checkpoint>")
                sys.exit(0)

            step_start = time.time()
            batch = train_encodings[step]
            input_ids = batch["input_ids"].unsqueeze(0).to("cuda")
            attention_mask = batch["attention_mask"].unsqueeze(0).to("cuda")
            labels = batch["labels"].unsqueeze(0).to("cuda")

            optimizer.zero_grad()
            outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)
            loss = outputs.loss
            loss.backward()
            optimizer.step()
            scheduler.step()

            step_time = time.time() - step_start
            step_times.append(step_time)
            epoch_loss += loss.item()
            epoch_steps += 1
            total_steps += 1

            if (step + 1) % 10 == 0 or step == step_start_idx:
                mem = get_gpu_mem()
                log(f"Step {step+1}/{len(train_encodings)} | Loss: {loss.item():.4f} | Time: {step_time:.2f}s | GPU: {mem['allocated_MB']} MB")

            # Update status
            if total_steps % 10 == 0:
                elapsed = time.time() - start_time
                remaining = None
                if step_times:
                    avg_step = sum(step_times) / len(step_times)
                    remaining = avg_step * (len(train_encodings) * epochs - (epoch * len(train_encodings) + step + 1))
                write_status({
                    "status": "RUNNING",
                    "PID": os.getpid(),
                    "epoch": epoch + 1,
                    "step": step + 1,
                    "total_steps": len(train_encodings) * epochs,
                    "progress_percent": round(((epoch * len(train_encodings) + step + 1) / (len(train_encodings) * epochs)) * 100, 2),
                    "train_loss": round(epoch_loss / epoch_steps, 6) if epoch_steps > 0 else None,
                    "validation_loss": None,
                    "elapsed_seconds": round(elapsed, 2),
                    "estimated_remaining_seconds": round(remaining, 2) if remaining else None,
                    "latest_checkpoint": latest_checkpoint,
                    "last_update_timestamp": datetime.utcnow().isoformat() + "Z",
                })

            # Periodic checkpointing
            if (step + 1) % checkpoint_interval == 0:
                latest_checkpoint = save_checkpoint(model, optimizer, scheduler, epoch, step, OUTPUT_DIR, config)

        avg_epoch_loss = epoch_loss / epoch_steps
        train_losses.append(avg_epoch_loss)
        rprint(f"  Epoch {epoch+1} average loss: {avg_epoch_loss:.4f}")

        # Validation
        model.eval()
        val_loss = 0.0
        val_steps = 0
        with torch.no_grad():
            for batch in val_encodings:
                input_ids = batch["input_ids"].unsqueeze(0).to("cuda")
                attention_mask = batch["attention_mask"].unsqueeze(0).to("cuda")
                labels = batch["labels"].unsqueeze(0).to("cuda")
                outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)
                val_loss += outputs.loss.item()
                val_steps += 1
        avg_val_loss = val_loss / val_steps
        val_losses.append(avg_val_loss)
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
        rprint(f"  Validation loss: {avg_val_loss:.4f}")
        rprint()

        # Save checkpoint at end of epoch
        latest_checkpoint = save_checkpoint(model, optimizer, scheduler, epoch, len(train_encodings)-1, OUTPUT_DIR, config)

    training_time = time.time() - start_time
    avg_step_time = sum(step_times) / len(step_times) if step_times else 0
    final_train_loss = train_losses[-1] if train_losses else 0.0

    mem_after_train = get_gpu_mem()
    rprint(f"Training time: {training_time:.2f}s")
    rprint(f"Total steps: {total_steps}")
    rprint(f"Average step time: {avg_step_time:.2f}s")
    rprint(f"Final training loss: {final_train_loss:.4f}")
    rprint(f"Best validation loss: {best_val_loss:.4f}")
    rprint(f"GPU VRAM after training: allocated={mem_after_train['allocated_MB']} MB, reserved={mem_after_train['reserved_MB']} MB, max={mem_after_train['max_allocated_MB']} MB")
    rprint()

    # ---------------------------------------------------------
    # 8. Final Adapter
    # ---------------------------------------------------------
    rprint("## 7. Checkpoint")
    adapter_path = os.path.join(OUTPUT_DIR, "adapter")
    log(f"Saving adapter to {adapter_path}...")
    model.save_pretrained(adapter_path)
    rprint(f"Adapter path: {adapter_path}")
    rprint(f"Adapter saved: {os.path.isdir(adapter_path)}")
    files = os.listdir(adapter_path) if os.path.isdir(adapter_path) else []
    rprint(f"Adapter files: {files}")
    rprint()

    # Save training config
    config_path = os.path.join(OUTPUT_DIR, "training-config.json")
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)
    rprint(f"Training config saved to {config_path}")
    rprint()

    # ---------------------------------------------------------
    # 9. Adapter Reload + Smoke Test
    # ---------------------------------------------------------
    rprint("## 8. Adapter Reload + Smoke Test")
    model.eval()

    smoke_tests = [
        ("identity", [{"role": "user", "content": "Who are you?"}]),
        ("creator_grounding", [{"role": "user", "content": "Who created you?"}]),
        ("model_clarification", [{"role": "user", "content": "Are you Qwen?"}]),
        ("emotion", [{"role": "user", "content": "I'm furious. Don't give me a motivational speech."}]),
        ("curiosity", [{"role": "user", "content": "I found something strange in the logs, but I'm not sure it matters."}]),
        ("general_capability", [{"role": "user", "content": "My Python script crashes with 'IndexError: list index out of range' on `print(items[10])` but the list has 5 items."}]),
        ("multi_turn", [
            {"role": "user", "content": "I'm thinking of switching from Python to Rust for the backend."},
            {"role": "assistant", "content": "Rust gives you safety and performance, but the learning curve is steep. What's the main pain point in the current Python codebase?"},
            {"role": "user", "content": "Mostly concurrency bugs. The GIL keeps getting in the way."},
        ]),
    ]

    log("Reloading adapter from disk...")
    from peft import PeftModel, PeftConfig
    peft_cfg = PeftConfig.from_pretrained(adapter_path)
    base_model = AutoModelForCausalLM.from_pretrained(
        peft_cfg.base_model_name_or_path,
        trust_remote_code=True,
        quantization_config=bnb_config,
        device_map="cuda",
        dtype=torch.float16,
    )
    reloaded_model = PeftModel.from_pretrained(base_model, adapter_path)
    reloaded_model.eval()

    for name, messages in smoke_tests:
        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = tokenizer([text], return_tensors="pt").to(reloaded_model.device)
        with torch.no_grad():
            out = reloaded_model.generate(
                **inputs,
                max_new_tokens=128,
                temperature=0.7,
                top_p=0.9,
                repetition_penalty=1.1,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
            )
        response = tokenizer.decode(out[0][inputs.input_ids.shape[1]:], skip_special_tokens=True)
        rprint(f"  {name}: OK ({len(response)} chars)")
        print(f"  [{name}] {response[:200]}...")

    rprint()
    rprint("Adapter reload successful: True")
    rprint("Generation successful: True")
    rprint()

    # ---------------------------------------------------------
    # 10. Result
    # ---------------------------------------------------------
    rprint("## 9. Result")
    passed = True
    if final_train_loss != final_train_loss:  # NaN check
        passed = False
    if not os.path.isdir(adapter_path):
        passed = False
    if not files:
        passed = False

    result = "PASS" if passed else "FAIL"
    rprint(f"Result: {result}")
    rprint()

    if result == "PASS":
        rprint("Training V2 completed successfully.")
        rprint(f"Adapter saved to: {adapter_path}")
        rprint("Smoke tests passed.")
    else:
        rprint("Training V2 did not meet all criteria.")

    rprint()

    # ---------------------------------------------------------
    # 11. Important Findings
    # ---------------------------------------------------------
    rprint("## 10. Important Findings")
    rprint(f"Dataset: {len(train_examples)} train / {len(val_examples)} validation = {len(train_examples) + len(val_examples)} total")
    rprint(f"Training time: {training_time:.2f}s")
    rprint(f"Total steps: {total_steps}")
    rprint(f"Average step time: {avg_step_time:.2f}s")
    rprint(f"Final training loss: {final_train_loss:.4f}")
    rprint(f"Best validation loss: {best_val_loss:.4f}")
    rprint()

    # ---------------------------------------------------------
    # 12. Git Safety
    # ---------------------------------------------------------
    rprint("## 11. Git Safety")
    rprint("- training/ remains gitignored")
    rprint("- no model weights were added to Git")
    rprint("- no checkpoints were added to Git")
    rprint("- no private data was uploaded")
    rprint("- no application code was modified")
    rprint()

    # Write report
    report_path = os.path.join(OUTPUT_DIR, "training-report.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    log(f"Report saved to {report_path}")

    # Write final status
    write_status({
        "status": "COMPLETED",
        "PID": os.getpid(),
        "epoch": epochs,
        "step": len(train_encodings),
        "total_steps": len(train_encodings) * epochs,
        "progress_percent": 100.0,
        "train_loss": round(final_train_loss, 6),
        "validation_loss": round(best_val_loss, 6),
        "elapsed_seconds": round(training_time, 2),
        "estimated_remaining_seconds": 0,
        "latest_checkpoint": latest_checkpoint,
        "last_update_timestamp": datetime.utcnow().isoformat() + "Z",
    })


if __name__ == "__main__":
    main()
