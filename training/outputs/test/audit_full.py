import json
from collections import defaultdict

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

categories = ['cognition', 'emotion', 'curiosity', 'memory', 'personality', 'anomalies']

for cat in categories:
    print(f'=== {cat.upper()} SAMPLES (train) ===')
    for ex in by_cat[cat]['train'][:3]:
        print(f"ID: {ex['metadata']['id']}")
        print(f"User: {ex['messages'][0]['content']}")
        print(f"Assistant: {ex['messages'][-1]['content']}")
        print()
    print(f'=== {cat.upper()} SAMPLES (validation) ===')
    for ex in by_cat[cat]['validation'][:3]:
        print(f"ID: {ex['metadata']['id']}")
        print(f"User: {ex['messages'][0]['content']}")
        print(f"Assistant: {ex['messages'][-1]['content']}")
        print()

# Check for repeated templates
print('=== TEMPLATE CHECK ===')
templates = [
    "I shouldn't",
    "I should not",
    "I cannot",
    "The runtime",
    "The system",
    "I must",
    "I don't have",
    "I don't",
    "No.",
    "Not exactly",
    "That's a",
]

all_text = " ".join(
    ex['messages'][-1]['content']
    for ex in all_examples
    if ex.get('messages')
)

for template in templates:
    count = all_text.lower().count(template.lower())
    if count > 5:
        print(f"High frequency: '{template}' appears {count} times")

# Check for multi-turn examples
print()
print('=== MULTI-TURN EXAMPLES ===')
multi_turn = [ex for ex in all_examples if len(ex.get('messages', [])) > 2]
print(f'Total multi-turn: {len(multi_turn)}')
for ex in multi_turn[:5]:
    print(f"ID: {ex['metadata']['id']} | turns: {len(ex['messages'])}")
    for msg in ex['messages']:
        print(f"  {msg['role']}: {msg['content'][:80]}...")
    print()
