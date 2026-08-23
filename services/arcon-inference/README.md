# Arcon LoRA Inference Service

Python FastAPI service that serves Qwen3-4B + configurable LoRA adapter over HTTP.

## Prerequisites

- Python 3.11+
- NVIDIA GPU with CUDA
- A Python virtual environment with PyTorch, transformers, peft, and fastapi installed

## Start the service

```powershell
# Windows
$env:ARCON_BASE_MODEL = "Qwen/Qwen3-4B"
$env:ARCON_ADAPTER_PATH = "training/outputs/arcon-v1/adapter"
$env:ARCON_ADAPTER_NAME = "arcon-v1"

python services/arcon-inference/main.py
```

```bash
# macOS / Linux
export ARCON_BASE_MODEL="Qwen/Qwen3-4B"
export ARCON_ADAPTER_PATH="training/outputs/arcon-v1/adapter"
export ARCON_ADAPTER_NAME="arcon-v1"

python services/arcon-inference/main.py
```

The service listens on `http://127.0.0.1:8000` by default.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ARCON_BASE_MODEL` | `Qwen/Qwen3-4B` | Hugging Face model ID |
| `ARCON_ADAPTER_PATH` | `""` | Path to LoRA adapter directory |
| `ARCON_ADAPTER_NAME` | `""` | Adapter name for model metadata |
| `ARCON_INFERENCE_HOST` | `127.0.0.1` | Bind host |
| `ARCON_INFERENCE_PORT` | `8000` | Bind port |
| `ARCON_MAX_NEW_TOKENS` | `512` | Max generation length |
| `ARCON_TEMPERATURE` | `0.7` | Sampling temperature |
| `ARCON_TOP_P` | `0.9` | Top-p sampling |
| `ARCON_REPETITION_PENALTY` | `1.1` | Repetition penalty |

## Endpoints

- `GET /health` — Health check
- `GET /v1/models` — Model metadata including adapter info
- `POST /v1/chat/completions` — Chat completion (OpenAI-compatible)

## Node.js runtime connection

Set in the server environment:

```powershell
$env:ARCON_INFERENCE_BACKEND = "arcon-lora"
$env:ARCON_INFERENCE_BASE_URL = "http://127.0.0.1:8000"
$env:ARCON_ADAPTER_NAME = "arcon-v1"
```
