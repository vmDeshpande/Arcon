import json
from collections import Counter

all_examples = []
for split in ['train', 'validation']:
    with open(f'C:/Projects/Arcon/training/datasets/arcon_v1/{split}.jsonl', 'r') as f:
        for line in f:
            if line.strip():
                all_examples.append(json.loads(line))

identity_in_assembly = [ex for ex in all_examples if ex.get('metadata', {}).get('category') == 'identity']
print(f'Identity examples in assembled dataset: {len(identity_in_assembly)}')

# Verify all Batch 5 are there
batch5 = ['identity-0075', 'identity-0076', 'identity-0077', 'identity-0078', 'identity-0079']
for id_val in batch5:
    found = any(ex.get('metadata', {}).get('id') == id_val for ex in all_examples)
    status = 'FOUND' if found else 'MISSING'
    print(f'{id_val}: {status}')

# Count multi-turn
multi_turn = [ex for ex in all_examples if len(ex.get('messages', [])) > 2]
print(f'Multi-turn examples: {len(multi_turn)}')

# Count general capability (personality + general subcategories)
general_caps = [ex for ex in all_examples if ex.get('metadata', {}).get('category') == 'personality']
print(f'Personality/general-capability examples: {len(general_caps)}')

# Category counts
cats = Counter(ex.get('metadata', {}).get('category', 'unknown') for ex in all_examples)
print(f'Category counts: {dict(cats)}')

# Train/validation
train_count = sum(1 for ex in all_examples if ex.get('metadata', {}).get('split') == 'train')
val_count = sum(1 for ex in all_examples if ex.get('metadata', {}).get('split') == 'validation')
print(f'Train: {train_count}, Validation: {val_count}')
