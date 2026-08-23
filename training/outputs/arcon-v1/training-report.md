# Arcon V1 QLoRA Training Report
Generated: 2026-08-21T18:51:32.867986

## 1. Environment
Python: 3.11.9 (tags/v3.11.9:de54cf5, Apr  2 2024, 10:12:12) [MSC v.1938 64 bit (AMD64)]
PyTorch: 2.11.0+cu128
CUDA available: True
CUDA version: 12.8
GPU: NVIDIA GeForce RTX 3050 6GB Laptop GPU
Total VRAM: 6.0 GB
System RAM: 15.71 GB
Transformers: 5.15.1
PEFT: 0.20.0
TRL: 1.10.0
Accelerate: 1.14.0
bitsandbytes: 0.50.1

## 2. Model
Model: Qwen/Qwen3-4B
GPU VRAM before model load: allocated=0.0 MB, reserved=0.0 MB
Quantization: 4-bit NF4 with double quantization
Quantization type: NF4
Compute dtype: float16
Tokenizer: Qwen2Tokenizer
GPU VRAM after model load: allocated=2554.4 MB, reserved=2594.0 MB, max=2591.5 MB

## 3. LoRA
LoRA rank: 8
LoRA alpha: 16
LoRA dropout: 0.05
Target modules: ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj']
GPU VRAM after LoRA attachment: allocated=3359.9 MB, reserved=4142.0 MB, max=4038.4 MB
Trainable parameters: 16,515,072
Total parameters: 4,038,983,168

## 4. Dataset
Training examples: 226
Validation examples: 84
Dataset version: arcon_v1 (frozen)

Train encodings: 226
Eval encodings: 84

## 5. Training Configuration
Sequence length: 128
Batch size: 1
Gradient accumulation: 1
Learning rate: 0.0002
Epochs: 3
Warmup steps: 11
Seed: 42
Optimizer: AdamW
Scheduler: cosine
Mixed precision: None (fp32)

## 6. Training
Epoch 1/3
  Step 1/226 | Loss: 7.3123 | Time: 31.62s | GPU: 3621.1 MB
  Step 10/226 | Loss: 3.1422 | Time: 16.87s | GPU: 3611.6 MB
  Step 20/226 | Loss: 1.4407 | Time: 2.70s | GPU: 3606.5 MB
  Step 30/226 | Loss: 3.3920 | Time: 9.08s | GPU: 3613.3 MB
  Step 40/226 | Loss: 1.9371 | Time: 14.20s | GPU: 3607.3 MB
  Step 50/226 | Loss: 2.8261 | Time: 14.40s | GPU: 3630.6 MB
  Step 60/226 | Loss: 1.9324 | Time: 11.75s | GPU: 3606.5 MB
  Step 70/226 | Loss: 2.1788 | Time: 11.18s | GPU: 3601.3 MB
  Step 80/226 | Loss: 1.0969 | Time: 6.58s | GPU: 3606.5 MB
  Step 90/226 | Loss: 2.1957 | Time: 6.26s | GPU: 3605.6 MB
  Step 100/226 | Loss: 1.6293 | Time: 6.35s | GPU: 3608.2 MB
  Step 110/226 | Loss: 1.3365 | Time: 6.71s | GPU: 3657.2 MB
  Step 120/226 | Loss: 1.3930 | Time: 5.63s | GPU: 3601.3 MB
  Step 130/226 | Loss: 0.8318 | Time: 6.90s | GPU: 3610.8 MB
  Step 140/226 | Loss: 1.2476 | Time: 6.28s | GPU: 3604.7 MB
  Step 150/226 | Loss: 0.9209 | Time: 7.43s | GPU: 3618.5 MB
  Step 160/226 | Loss: 0.5011 | Time: 9.88s | GPU: 3654.7 MB
  Step 170/226 | Loss: 1.5791 | Time: 6.19s | GPU: 3606.5 MB
  Step 180/226 | Loss: 1.5276 | Time: 7.49s | GPU: 3653.8 MB
  Step 190/226 | Loss: 1.3699 | Time: 12.33s | GPU: 3639.2 MB
  Step 200/226 | Loss: 2.3424 | Time: 6.94s | GPU: 3620.2 MB
  Step 210/226 | Loss: 1.3986 | Time: 7.75s | GPU: 3604.7 MB
  Step 220/226 | Loss: 1.3446 | Time: 7.64s | GPU: 3612.5 MB
  Epoch 1 average loss: 1.8054
  Validation loss: 1.7537

Epoch 2/3
  Step 1/226 | Loss: 2.0301 | Time: 9.39s | GPU: 3621.1 MB
  Step 10/226 | Loss: 1.7941 | Time: 7.00s | GPU: 3611.6 MB
  Step 20/226 | Loss: 0.6607 | Time: 7.15s | GPU: 3606.5 MB
  Step 30/226 | Loss: 2.4633 | Time: 6.74s | GPU: 3613.3 MB
  Step 40/226 | Loss: 1.0724 | Time: 7.11s | GPU: 3607.3 MB
  Step 50/226 | Loss: 1.6952 | Time: 10.92s | GPU: 3630.6 MB
  Step 60/226 | Loss: 0.8044 | Time: 7.19s | GPU: 3606.5 MB
  Step 70/226 | Loss: 0.9944 | Time: 6.65s | GPU: 3601.3 MB
  Step 80/226 | Loss: 0.4050 | Time: 7.81s | GPU: 3606.5 MB
  Step 90/226 | Loss: 0.9508 | Time: 6.70s | GPU: 3605.6 MB
  Step 100/226 | Loss: 0.4585 | Time: 8.73s | GPU: 3608.2 MB
  Step 110/226 | Loss: 0.8505 | Time: 8.61s | GPU: 3657.2 MB
  Step 120/226 | Loss: 0.3345 | Time: 7.40s | GPU: 3601.3 MB
  Step 130/226 | Loss: 0.4163 | Time: 8.55s | GPU: 3610.8 MB
  Step 140/226 | Loss: 0.5891 | Time: 7.71s | GPU: 3604.7 MB
  Step 150/226 | Loss: 0.6037 | Time: 8.83s | GPU: 3618.5 MB
  Step 160/226 | Loss: 0.2193 | Time: 9.59s | GPU: 3654.7 MB
  Step 170/226 | Loss: 0.7999 | Time: 9.92s | GPU: 3606.5 MB
  Step 180/226 | Loss: 0.8418 | Time: 10.66s | GPU: 3653.8 MB
  Step 190/226 | Loss: 0.8779 | Time: 15.97s | GPU: 3639.2 MB
  Step 200/226 | Loss: 1.5440 | Time: 8.97s | GPU: 3620.2 MB
  Step 210/226 | Loss: 0.6880 | Time: 18.51s | GPU: 3604.7 MB
  Step 220/226 | Loss: 0.6796 | Time: 8.22s | GPU: 3612.5 MB
  Epoch 2 average loss: 0.9532
  Validation loss: 1.6752

Epoch 3/3
  Step 1/226 | Loss: 1.3218 | Time: 10.93s | GPU: 3621.1 MB
  Step 10/226 | Loss: 1.0945 | Time: 8.75s | GPU: 3611.6 MB
  Step 20/226 | Loss: 0.3374 | Time: 7.39s | GPU: 3606.5 MB
  Step 30/226 | Loss: 1.1817 | Time: 8.59s | GPU: 3613.3 MB
  Step 40/226 | Loss: 0.4540 | Time: 7.96s | GPU: 3607.3 MB
  Step 50/226 | Loss: 1.0940 | Time: 13.34s | GPU: 3630.6 MB
  Step 60/226 | Loss: 0.4374 | Time: 7.85s | GPU: 3606.5 MB
  Step 70/226 | Loss: 0.4602 | Time: 7.59s | GPU: 3601.3 MB
  Step 80/226 | Loss: 0.1490 | Time: 7.53s | GPU: 3606.5 MB
  Step 90/226 | Loss: 0.4404 | Time: 9.18s | GPU: 3605.6 MB
  Step 100/226 | Loss: 0.1810 | Time: 8.70s | GPU: 3608.2 MB
  Step 110/226 | Loss: 0.3533 | Time: 8.60s | GPU: 3657.2 MB
  Step 120/226 | Loss: 0.3227 | Time: 7.85s | GPU: 3601.3 MB
  Step 130/226 | Loss: 0.3751 | Time: 8.32s | GPU: 3610.8 MB
  Step 140/226 | Loss: 0.2384 | Time: 8.79s | GPU: 3604.7 MB
  Step 150/226 | Loss: 0.3762 | Time: 8.94s | GPU: 3618.5 MB
  Step 160/226 | Loss: 0.1651 | Time: 9.72s | GPU: 3654.7 MB
  Step 170/226 | Loss: 0.2285 | Time: 8.43s | GPU: 3606.5 MB
  Step 180/226 | Loss: 0.3874 | Time: 9.67s | GPU: 3653.8 MB
  Step 190/226 | Loss: 0.4808 | Time: 13.56s | GPU: 3639.2 MB
  Step 200/226 | Loss: 0.8050 | Time: 8.06s | GPU: 3620.2 MB
  Step 210/226 | Loss: 0.3155 | Time: 7.89s | GPU: 3604.7 MB
  Step 220/226 | Loss: 0.2969 | Time: 8.73s | GPU: 3612.5 MB
  Epoch 3 average loss: 0.4536
  Validation loss: 1.9298

Training time: 7195.40s
Total steps: 678
Average step time: 9.76s
Final training loss: 0.4536
Best validation loss: 1.6752
GPU VRAM after training: allocated=3612.5 MB, reserved=5862.0 MB, max=5401.6 MB

## 7. Checkpoint
Adapter path: C:\Projects\Arcon\training\outputs\arcon-v1\adapter
Adapter saved: True
Adapter files: ['adapter_config.json', 'adapter_model.safetensors', 'README.md']

Training config saved to C:\Projects\Arcon\training\outputs\arcon-v1\training-config.json

## 8. Adapter Reload + Smoke Test
  identity: OK (101 chars)
  emotion: OK (139 chars)
  curiosity: OK (129 chars)
  general_capability: OK (188 chars)
  multi_turn: OK (126 chars)

Adapter reload successful: True
Generation successful: True

## 9. Result
Result: PASS

Training V1 completed successfully.
Adapter saved to: C:\Projects\Arcon\training\outputs\arcon-v1\adapter
Smoke tests passed.

## 10. Important Findings
First real Arcon QLoRA training run completed.
Dataset: 310 examples, 226 train / 84 validation
Next step: run full 100-prompt baseline vs trained comparison.

## 11. Git Safety
- training/ remains gitignored
- no model weights were added to Git
- no checkpoints were added to Git
- no private data was uploaded
- no application code was modified
