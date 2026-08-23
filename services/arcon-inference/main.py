#!/usr/bin/env python3
"""Arcon LoRA Inference Service.

Serves Qwen3-4B + configurable LoRA adapter over HTTP.
OpenAI-compatible chat completions for Node.js runtime integration.
"""

import os
import sys
import json
import time
import uuid
import logging
import traceback
from datetime import datetime, timezone
from typing import Optional

sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
from peft import PeftModel, PeftConfig

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("arcon-inference")

app = FastAPI(title="Arcon LoRA Inference", version="1.0.0")

BASE_MODEL_ID = os.environ.get("ARCON_BASE_MODEL", "Qwen/Qwen3-4B")
ADAPTER_PATH = os.environ.get("ARCON_ADAPTER_PATH", "")
ADAPTER_NAME = os.environ.get("ARCON_ADAPTER_NAME", "")
HOST = os.environ.get("ARCON_INFERENCE_HOST", "127.0.0.1")
PORT = int(os.environ.get("ARCON_INFERENCE_PORT", "8000"))
MAX_NEW_TOKENS = int(os.environ.get("ARCON_MAX_NEW_TOKENS", "512"))
TEMPERATURE = float(os.environ.get("ARCON_TEMPERATURE", "0.7"))
TOP_P = float(os.environ.get("ARCON_TOP_P", "0.9"))
REPETITION_PENALTY = float(os.environ.get("ARCON_REPETITION_PENALTY", "1.1"))

tokenizer = None
model = None
peft_config: Optional[PeftConfig] = None
model_load_time: Optional[str] = None


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompletionRequest(BaseModel):
    model: Optional[str] = None
    messages: list[ChatMessage]
    stream: bool = False
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    top_p: Optional[float] = None


class ChatCompletionChoice(BaseModel):
    index: int
    message: dict
    finish_reason: str


class ChatCompletionUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: list[ChatCompletionChoice]
    usage: ChatCompletionUsage


class ModelInfoResponse(BaseModel):
    id: str
    object: str = "model"
    created: int
    owned_by: str = "arcon"
    base_model: str
    adapter_name: str
    adapter_path: str
    adapter_version: str = "unknown"
    inference_backend: str = "PEFT/Transformers"


def load_model():
    global tokenizer, model, peft_config, model_load_time

    if model is not None:
        return

    logger.info("Loading base model: %s", BASE_MODEL_ID)
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL_ID, trust_remote_code=True, use_fast=True)
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
        BASE_MODEL_ID,
        trust_remote_code=True,
        quantization_config=bnb_config,
        device_map="cuda",
        dtype=torch.float16,
    )

    if ADAPTER_PATH and os.path.isdir(ADAPTER_PATH):
        logger.info("Loading LoRA adapter: %s", ADAPTER_PATH)
        peft_config = PeftConfig.from_pretrained(ADAPTER_PATH)
        model = PeftModel.from_pretrained(model, ADAPTER_PATH, inference_mode=True)
        model.eval()
        logger.info("Adapter loaded. base_model=%s r=%d target_modules=%s", peft_config.base_model_name_or_path, peft_config.r, peft_config.target_modules)
    else:
        logger.warning("No adapter loaded. ADAPTER_PATH=%s", ADAPTER_PATH)
        peft_config = None
        model.eval()

    model_load_time = datetime.now(timezone.utc).isoformat()
    mem = _get_gpu_mem()
    logger.info("Model ready. GPU allocated=%s MB reserved=%s MB", mem["allocated_MB"], mem["reserved_MB"])


def _get_gpu_mem():
    if not torch.cuda.is_available():
        return {"allocated_MB": 0, "reserved_MB": 0}
    return {
        "allocated_MB": round(torch.cuda.memory_allocated() / 1024**2, 1),
        "reserved_MB": round(torch.cuda.memory_reserved() / 1024**2, 1),
    }


def _generate(messages: list[dict], max_new_tokens: int, temperature: float, top_p: float, repetition_penalty: float, stream: bool = False):
    global tokenizer, model

    if model is None or tokenizer is None:
        raise RuntimeError("Model not loaded")

    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
    inputs = tokenizer([text], return_tensors="pt").to(model.device)

    generation_kwargs = dict(
        **inputs,
        max_new_tokens=max_new_tokens,
        temperature=temperature,
        top_p=top_p,
        repetition_penalty=repetition_penalty,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id,
    )

    if stream:
        from transformers import TextIteratorStreamer
        from threading import Thread

        streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
        generation_kwargs["streamer"] = streamer
        generation_kwargs.pop("max_new_tokens", None)
        generation_kwargs.pop("temperature", None)
        generation_kwargs.pop("top_p", None)
        generation_kwargs.pop("repetition_penalty", None)
        generation_kwargs.pop("do_sample", None)

        t = Thread(target=model.generate, kwargs=generation_kwargs)
        t.start()

        for token in streamer:
            yield token
        t.join()
    else:
        with torch.no_grad():
            outputs = model.generate(**generation_kwargs)
        generated_ids = outputs[0][inputs.input_ids.shape[1]:]
        yield tokenizer.decode(generated_ids, skip_special_tokens=True)


@app.get("/health")
async def health():
    return JSONResponse({"status": "ok", "model_loaded": model is not None})


@app.get("/v1/models")
async def get_models():
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    adapter_version = "unknown"
    if peft_config is not None:
        adapter_version = f"rank-{peft_config.r}"

    return JSONResponse({
        "id": f"arcon-{ADAPTER_NAME or 'base'}",
        "object": "model",
        "created": int(datetime.now(timezone.utc).timestamp()),
        "owned_by": "arcon",
        "base_model": BASE_MODEL_ID,
        "adapter_name": ADAPTER_NAME or "none",
        "adapter_path": ADAPTER_PATH or "none",
        "adapter_version": adapter_version,
        "inference_backend": "PEFT/Transformers",
        "gpu_memory": _get_gpu_mem(),
        "loaded_at": model_load_time,
    })


@app.post("/v1/chat/completions")
async def chat_completions(request: ChatCompletionRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    messages = [{"role": m.role, "content": m.content} for m in request.messages]
    max_new_tokens = request.max_tokens or MAX_NEW_TOKENS
    temperature = request.temperature if request.temperature is not None else TEMPERATURE
    top_p = request.top_p if request.top_p is not None else TOP_P

    model_id = f"arcon-{ADAPTER_NAME or 'base'}"

    if request.stream:
        async def generate_stream():
            completion_id = f"chatcmpl-{uuid.uuid4().hex}"
            created = int(datetime.now(timezone.utc).timestamp())

            yield f"data: {json.dumps({'id': completion_id, 'object': 'chat.completion.chunk', 'created': created, 'model': model_id, 'choices': [{'index': 0, 'delta': {'role': 'assistant', 'content': ''}, 'finish_reason': None}]})}\n\n"

            full_text = ""
            for token in _generate(messages, max_new_tokens, temperature, top_p, REPETITION_PENALTY, stream=True):
                full_text += token
                chunk = {
                    "id": completion_id,
                    "object": "chat.completion.chunk",
                    "created": created,
                    "model": model_id,
                    "choices": [{"index": 0, "delta": {"content": token}, "finish_reason": None}],
                }
                yield f"data: {json.dumps(chunk)}\n\n"

            yield f"data: {json.dumps({'id': completion_id, 'object': 'chat.completion.chunk', 'created': created, 'model': model_id, 'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]})}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(generate_stream(), media_type="text/event-stream")

    start = time.time()
    full_text = ""
    for text in _generate(messages, max_new_tokens, temperature, top_p, REPETITION_PENALTY, stream=False):
        full_text = text

    elapsed = time.time() - start
    prompt_len = len(tokenizer.apply_chat_template(messages, tokenize=True))
    completion_len = len(tokenizer.encode(full_text))

    response = ChatCompletionResponse(
        id=f"chatcmpl-{uuid.uuid4().hex}",
        created=int(datetime.now(timezone.utc).timestamp()),
        model=model_id,
        choices=[
            ChatCompletionChoice(
                index=0,
                message={"role": "assistant", "content": full_text},
                finish_reason="stop",
            )
        ],
        usage=ChatCompletionUsage(
            prompt_tokens=prompt_len,
            completion_tokens=completion_len,
            total_tokens=prompt_len + completion_len,
        ),
    )

    logger.info("Generated %d chars in %.2fs", len(full_text), elapsed)
    return JSONResponse(response.model_dump())


@app.on_event("startup")
async def startup():
    load_model()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
