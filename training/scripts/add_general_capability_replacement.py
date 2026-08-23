import json, os

SOURCES = 'training/datasets/arcon_v1/sources'

example = {
    'messages': [
        {'role': 'user', 'content': 'What is the square root of 144?'},
        {'role': 'assistant', 'content': '12.'}
    ],
    'metadata': {'id': 'general-0016', 'category': 'personality', 'subcategory': 'math', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
}

path = os.path.join(SOURCES, 'personality.jsonl')
with open(path, 'a', encoding='utf-8') as f:
    f.write(json.dumps(example, ensure_ascii=False) + '\n')

print('Added replacement general capability example')
