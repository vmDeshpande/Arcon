# Qwen3-4B Arcon Baseline

## Environment

Python: 3.10+
PyTorch: 2.11.0+cu128
CUDA: 12.8
GPU: NVIDIA GeForce RTX 3050 6GB
VRAM: 6144 MiB

## Model

Model: Qwen/Qwen3-4B
Quantization: 4-bit NF4
Compute dtype: float16

## Evaluation

Total prompts: 100
Identity: 15
Cognition: 15
Emotion: 10
Memory: 10
Curiosity: 10
Personality: 10
Anomalies: 10
General capability: 15
Multi-turn: 5

## Performance

Average generation time: 42.16s
Total evaluation time: 4215.72s
Peak VRAM: 2639 MB

## Behavioral observations

Baseline evaluation completed on vanilla Qwen3-4B without Arcon training or LoRA adapter.

## Important baseline behaviors

See training/outputs/baseline/qwen3-4b-baseline.jsonl for detailed per-prompt responses.

## Result

BASELINE_COMPLETE
