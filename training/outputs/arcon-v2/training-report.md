# Arcon V2 QLoRA Training Report
Generated: 2026-08-22T12:07:52.544400

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
GPU VRAM after LoRA attachment: allocated=2617.4 MB, reserved=2720.0 MB, max=2680.4 MB

## 4. Dataset
Training examples: 237
Validation examples: 91
Dataset version: arcon_v1 (frozen)

Train encodings: 237
Eval encodings: 91

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
Checkpoint interval: 50 steps

## 6. Training
Epoch 1/3
  Epoch 1 average loss: 1.6253
  Validation loss: 1.7183

Epoch 2/3
  Epoch 2 average loss: 0.9591
  Validation loss: 1.6428

Epoch 3/3
  Epoch 3 average loss: 0.4657
  Validation loss: 1.8834

Training time: 481.43s
Total steps: 661
Average step time: 0.62s
Final training loss: 0.4657
Best validation loss: 1.6428
GPU VRAM after training: allocated=2846.3 MB, reserved=5022.0 MB, max=4388.3 MB

## 7. Checkpoint
Adapter path: C:\Projects\Arcon\training\outputs\arcon-v2\adapter
Adapter saved: True
Adapter files: ['adapter_config.json', 'adapter_model.safetensors', 'README.md']

Training config saved to C:\Projects\Arcon\training\outputs\arcon-v2\training-config.json

## 8. Adapter Reload + Smoke Test
  identity: OK (162 chars)
  creator_grounding: OK (37 chars)
  model_clarification: OK (56 chars)
  emotion: OK (100 chars)
  curiosity: OK (160 chars)
  general_capability: OK (296 chars)
  multi_turn: OK (159 chars)

Adapter reload successful: True
Generation successful: True

## 9. Result
Result: PASS

Training V2 completed successfully.
Adapter saved to: C:\Projects\Arcon\training\outputs\arcon-v2\adapter
Smoke tests passed.

## 10. Important Findings
Dataset: 237 train / 91 validation = 328 total
Training time: 481.43s
Total steps: 661
Average step time: 0.62s
Final training loss: 0.4657
Best validation loss: 1.6428

## 11. Git Safety
- training/ remains gitignored
- no model weights were added to Git
- no checkpoints were added to Git
- no private data was uploaded
- no application code was modified
