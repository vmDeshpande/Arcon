import json
from difflib import SequenceMatcher

filepath = 'C:/Projects/Arcon/training/datasets/arcon_v1/sources/identity.jsonl'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f'Total lines: {len(lines)}')

# Check JSON syntax
errors = []
for i, line in enumerate(lines, 1):
    line = line.strip()
    if not line:
        continue
    try:
        json.loads(line)
    except json.JSONDecodeError as e:
        errors.append(f'Line {i}: {e}')

if errors:
    print('JSON SYNTAX ERRORS:')
    for e in errors:
        print(f'  {e}')
else:
    print('JSON syntax: OK')

# Check duplicate IDs
ids = []
for i, line in enumerate(lines, 1):
    line = line.strip()
    if not line:
        continue
    data = json.loads(line)
    ids.append(data['metadata']['id'])

duplicate_ids = [id_val for id_val in set(ids) if ids.count(id_val) > 1]
if duplicate_ids:
    print(f'DUPLICATE IDs: {duplicate_ids}')
else:
    print('Duplicate IDs: None')

# Check duplicate/near-duplicate prompts
prompts = []
for i, line in enumerate(lines, 1):
    line = line.strip()
    if not line:
        continue
    data = json.loads(line)
    for msg in data['messages']:
        if msg['role'] == 'user':
            prompts.append((i, msg['content'].lower().strip()))

# Check for exact duplicates
prompt_texts = [p[1] for p in prompts]
duplicate_prompts = [p for p in set(prompt_texts) if prompt_texts.count(p) > 1]
if duplicate_prompts:
    print(f'DUPLICATE prompts: {duplicate_prompts}')
else:
    print('Duplicate prompts: None')

# Check for near-duplicate prompts
near_duplicates = []
for i in range(len(prompts)):
    for j in range(i+1, len(prompts)):
        ratio = SequenceMatcher(None, prompts[i][1], prompts[j][1]).ratio()
        if ratio > 0.8:
            near_duplicates.append((prompts[i], prompts[j], ratio))

if near_duplicates:
    print(f'NEAR-DUPLICATE prompts ({len(near_duplicates)} pairs):')
    for a, b, ratio in near_duplicates:
        print(f'  Line {a[0]} vs Line {b[0]} ({ratio:.2f}): {a[1][:50]}...')
else:
    print('Near-duplicate prompts: None')

# Check new examples
new_ids = ['identity-0060', 'identity-0061', 'identity-0062', 'identity-0063', 'identity-0064']
print()
print('NEW EXAMPLES CHECK:')
for id_val in new_ids:
    found = False
    for line in lines:
        if id_val in line:
            data = json.loads(line)
            subcategory = data['metadata']['subcategory']
            split = data['metadata']['split']
            user_content = data['messages'][0]['content']
            print(f'  {id_val}: {subcategory} | {split} | user: {user_content}')
            found = True
            break
    if not found:
        print(f'  {id_val}: NOT FOUND')

# Check Batch 1 rewrites are intact
batch1_rewrites = ['identity-0005', 'identity-0006', 'identity-0009', 'identity-0017', 'identity-0020', 'identity-0036']
print()
print('BATCH 1 REWRITES CHECK:')
for id_val in batch1_rewrites:
    if any(id_val in line for line in lines):
        print(f'  {id_val}: PRESENT')
    else:
        print(f'  {id_val}: MISSING (BAD)')

# Check Batch 1 removals are still gone
print()
print('BATCH 1 REMOVALS CHECK:')
for id_val in ['identity-0051', 'identity-0058']:
    if any(id_val in line for line in lines):
        print(f'  {id_val}: STILL PRESENT (BAD)')
    else:
        print(f'  {id_val}: REMOVED (GOOD)')

# Train/validation count
train_count = sum(1 for line in lines if json.loads(line)['metadata']['split'] == 'train')
val_count = sum(1 for line in lines if json.loads(line)['metadata']['split'] == 'validation')
print()
print(f'Train: {train_count}, Validation: {val_count}')
