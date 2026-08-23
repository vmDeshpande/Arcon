---
base_model: Qwen/Qwen3-4B
library_name: peft
pipeline_tag: text-generation
tags:
- base_model:adapter:Qwen/Qwen3-4B
- lora
- transformers
---

# Arcon V1 LoRA Adapter

QLoRA adapter fine-tuned on Qwen/Qwen3-4B for the Arcon cognitive architecture.

## Configuration

- Rank: 8
- Alpha: 16
- Dropout: 0.05
- Quantisation: 4-bit NF4
- Target modules: q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj

## Usage

Load with PEFT:

```python
from peft import PeftModel
model = PeftModel.from_pretrained(base_model, "training/outputs/arcon-v1/adapter")
```

## Notes

This adapter is part of the Arcon V1 runtime. It is not intended for standalone use without the accompanying Node.js cognitive layer and Python inference service.

The adapter weights (`adapter_model.safetensors`) are not tracked in Git due to size. This repository contains the adapter configuration and training code needed to reproduce them.
