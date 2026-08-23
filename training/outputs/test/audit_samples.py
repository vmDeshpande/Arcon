import json
from collections import Counter, defaultdict

# Load all examples
all_examples = []
for split in ['train', 'validation']:
    with open(f'C:/Projects/Arcon/training/datasets/arcon_v1/{split}.jsonl', 'r') as f:
        for line in f:
            if line.strip():
                all_examples.append(json.loads(line))

# Group by category and split
by_cat = defaultdict(lambda: {'train': [], 'validation': []})
for ex in all_examples:
    cat = ex.get('metadata', {}).get('category', 'unknown')
    split = ex.get('metadata', {}).get('split', 'train')
    by_cat[cat][split].append(ex)

# Print counts
for cat in ['identity', 'cognition', 'emotion', 'curiosity', 'memory', 'personality', 'anomalies']:
    train_count = len(by_cat[cat]['train'])
    val_count = len(by_cat[cat]['validation'])
    print(f'{cat}: train={train_count}, validation={val_count}')

print()
print('=== IDENTITY SAMPLES (train) ===')
for ex in by_cat['identity']['train'][:8]:
    print(f"ID: {ex['metadata']['id']}")
    print(f"User: {ex['messages'][0]['content']}")
    print(f"Assistant: {ex['messages'][-1]['content']}")
    print()

print('=== IDENTITY SAMPLES (validation) ===')
for ex in by_cat['identity']['validation'][:8]:
    print(f"ID: {ex['metadata']['id']}")
    print(f"User: {ex['messages'][0]['content']}")
    print(f"Assistant: {ex['messages'][-1]['content']}")
    print()
