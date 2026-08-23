import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = 'Qwen/Qwen3-4B'

print('Loading tokenizer...')
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=True)

print('Loading model on CPU...')
model = AutoModelForCausalLM.from_pretrained(MODEL_ID, torch_dtype=torch.float16, trust_remote_code=True)
model.eval()

print('Moving to CUDA...')
model = model.to('cuda')
print('Model on CUDA')

print('Testing generation...')
inputs = tokenizer(['Hello'], return_tensors='pt').to('cuda')
with torch.no_grad():
    out = model.generate(**inputs, max_new_tokens=20)
print(tokenizer.decode(out[0], skip_special_tokens=True))
print('SUCCESS')
