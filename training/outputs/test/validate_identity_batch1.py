import json

with open('C:/Projects/Arcon/training/datasets/arcon_v1/sources/identity.jsonl', 'r') as f:
    lines = f.readlines()

print(f'Total examples: {len(lines)}')

# Check identity-0005 content
for line in lines:
    data = json.loads(line)
    if data['metadata']['id'] == 'identity-0005':
        print('identity-0005 content:', repr(data['messages'][-1]['content']))
        break

# Verify removed IDs are gone
removed_ids = ['identity-0051', 'identity-0058']
for rid in removed_ids:
    if any(rid in line for line in lines):
        print(f'ERROR: {rid} still present!')
    else:
        print(f'{rid}: Confirmed removed')

# Verify all 6 rewrites
rewrites = {
    'identity-0005': "No. I'm not alive in the biological sense. I can have identity and state, but that's different from being a person.",
    'identity-0006': "Arcon. That's the name.",
    'identity-0009': 'No. The database stores memories, but Arcon is supposed to actually reason with them, not just look them up.',
    'identity-0017': "Then I should fix it. Identity should be stable, but not so rigid that I can't correct it when I'm wrong.",
    'identity-0020': "I don't. I have behavior and reasoning, but that's not the same thing.",
    'identity-0036': "I don't. I can work toward goals, but I don't want things the way people do.",
}

all_pass = True
for id_val, expected in rewrites.items():
    found = False
    for line in lines:
        data = json.loads(line)
        if data['metadata']['id'] == id_val:
            actual = data['messages'][-1]['content']
            if actual == expected:
                print(f'{id_val}: PASS')
            else:
                print(f'{id_val}: FAIL')
                print(f'  Expected: {expected}')
                print(f'  Actual: {actual}')
                all_pass = False
            found = True
            break
    if not found:
        print(f'{id_val}: NOT FOUND')
        all_pass = False

print()
print('All rewrites pass:', all_pass)

# Train/validation counts
train_count = sum(1 for line in lines if json.loads(line)['metadata']['split'] == 'train')
val_count = sum(1 for line in lines if json.loads(line)['metadata']['split'] == 'validation')
print(f'Train: {train_count}, Validation: {val_count}')
