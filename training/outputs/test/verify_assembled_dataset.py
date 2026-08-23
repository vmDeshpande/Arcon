import json

# Load train and validation
train_path = 'C:/Projects/Arcon/training/datasets/arcon_v1/train.jsonl'
val_path = 'C:/Projects/Arcon/training/datasets/arcon_v1/validation.jsonl'

all_examples = []
for path in [train_path, val_path]:
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                all_examples.append(json.loads(line))

print(f'Total examples: {len(all_examples)}')

# Count by category
from collections import Counter
cats = Counter(ex.get('metadata', {}).get('category', 'unknown') for ex in all_examples)
print(f'Categories: {dict(cats)}')

# Count multi-turn
multi_turn = [ex for ex in all_examples if len(ex.get('messages', [])) > 2]
print(f'Multi-turn examples: {len(multi_turn)}')

# Count general capability (personality category with general-capability subcategories)
general_caps = [ex for ex in all_examples if ex.get('metadata', {}).get('category') == 'personality']
print(f'Personality/general-capability examples: {len(general_caps)}')

# Check all 62 identity examples
identity_examples = [ex for ex in all_examples if ex.get('metadata', {}).get('category') == 'identity']
print(f'Identity examples: {len(identity_examples)}')

# Check Batch 5 new examples
batch5_ids = ['identity-0075', 'identity-0076', 'identity-0077', 'identity-0078', 'identity-0079']
found_batch5 = []
for id_val in batch5_ids:
    for ex in all_examples:
        if ex.get('metadata', {}).get('id') == id_val:
            found_batch5.append(id_val)
            break

print(f'Batch 5 examples found: {len(found_batch5)}/{len(batch5_ids)}')
for id_val in batch5_ids:
    if id_val in found_batch5:
        print(f'  {id_val}: PRESENT')
    else:
        print(f'  {id_val}: MISSING')

# Check all identity IDs
identity_ids = [ex.get('metadata', {}).get('id') for ex in identity_examples]
print(f'Identity IDs count: {len(identity_ids)}')

# Check for missing IDs in sequence
expected_identity_ids = [f'identity-{i:04d}' for i in range(1, 58)]  # 0001-0057 are original/batch1-4
# Add batch 2-5 new IDs
expected_identity_ids.extend(['identity-0060', 'identity-0061', 'identity-0062', 'identity-0063', 'identity-0064'])
expected_identity_ids.extend(['identity-0065', 'identity-0066', 'identity-0067', 'identity-0068', 'identity-0069'])
expected_identity_ids.extend(['identity-0070', 'identity-0071', 'identity-0072', 'identity-0073', 'identity-0074'])
expected_identity_ids.extend(['identity-0075', 'identity-0076', 'identity-0077', 'identity-0078', 'identity-0079'])

missing = [id_val for id_val in expected_identity_ids if id_val not in identity_ids]
print(f'Missing identity IDs: {len(missing)}')
if missing:
    for id_val in missing:
        print(f'  {id_val}')

# Train/validation split
train_count = sum(1 for ex in all_examples if ex.get('metadata', {}).get('split') == 'train')
val_count = sum(1 for ex in all_examples if ex.get('metadata', {}).get('split') == 'validation')
print(f'Train: {train_count}, Validation: {val_count}')

# Check max content length
max_len = max(len(m.get('content', '')) for ex in all_examples for m in ex.get('messages', []))
print(f'Max content length: {max_len}')
