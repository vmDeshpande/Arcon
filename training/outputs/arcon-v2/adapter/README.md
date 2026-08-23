---
base_model: Qwen/Qwen3-4B
library_name: peft
pipeline_tag: text-generation
tags:
- base_model:adapter:Qwen/Qwen3-4B
- lora
- transformers
---

# Arcon V2 LoRA Adapter (Candidate)

QLoRA adapter fine-tuned on Qwen/Qwen3-4B for the Arcon V2 candidate dataset.

## Status

This adapter has passed final pre-training audit and is approved with `READY_FOR_V2_TRAINING` status. It is not yet deployed in the active runtime.

## Configuration

- Rank: 8
- Alpha: 16
- Dropout: 0.05
- Quantisation: 4-bit NF4
- Target modules: q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj

## Notes

The adapter weights (`adapter_model.safetensors`) are not tracked in Git due to size. This repository contains the adapter configuration and training code.

Checkpoints are stored in `training/outputs/arcon-v2/checkpoints/` and are also not tracked in Git.
