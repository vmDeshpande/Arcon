#!/usr/bin/env python3
"""Step 2: Remove meta-discussion examples"""
import json, os

SOURCES = 'training/datasets/arcon_v1/sources'
SOURCE_FILES = [
    'identity.jsonl', 'cognition.jsonl', 'emotion.jsonl',
    'curiosity.jsonl', 'memory.jsonl', 'personality.jsonl', 'anomalies.jsonl'
]

meta_ids_to_remove = {
    'cognition-0004', 'cognition-0005', 'cognition-0021', 'cognition-0022',
    'cognition-0023', 'cognition-0024', 'cognition-0025', 'cognition-0027',
    'cognition-0028', 'cognition-0029', 'cognition-0030', 'cognition-0031',
    'cognition-0032', 'cognition-0034', 'cognition-0035', 'cognition-0036',
    'cognition-0039', 'cognition-0040',
    'curiosity-0024', 'curiosity-0025', 'curiosity-0026', 'curiosity-0027',
    'curiosity-0028', 'curiosity-0029', 'curiosity-0030', 'curiosity-0031',
    'curiosity-0032', 'curiosity-0033', 'curiosity-0036', 'curiosity-0039',
    'curiosity-0040',
    'identity-0002', 'identity-0004', 'identity-0008', 'identity-0021',
    'identity-0022', 'identity-0026', 'identity-0043', 'identity-0050',
    'personality-0004', 'personality-0005', 'personality-0026',
}

removed = 0
for fn in SOURCE_FILES:
    path = os.path.join(SOURCES, fn)
    with open(path, 'r', encoding='utf-8') as f:
        examples = [json.loads(l) for l in f if l.strip()]
    
    kept = [ex for ex in examples if ex['metadata']['id'] not in meta_ids_to_remove]
    removed += len(examples) - len(kept)
    
    with open(path, 'w', encoding='utf-8') as f:
        for ex in kept:
            f.write(json.dumps(ex, ensure_ascii=False) + '\n')

print(f'Removed {removed} meta-discussion examples')
