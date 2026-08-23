import json
import re
from collections import Counter, defaultdict

# Load all examples
all_examples = []
for split in ['train', 'validation']:
    with open(f'C:/Projects/Arcon/training/datasets/arcon_v1/{split}.jsonl', 'r') as f:
        for line in f:
            if line.strip():
                all_examples.append(json.loads(line))

# 1. Check for repeated templates
print('=== TEMPLATE ANALYSIS ===')
templates_to_check = [
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
    "I can't",
    "I'm not",
    "I am not",
    "I was built",
    "I was created",
    "Arcon is",
    "I'm Arcon",
]

all_assistant_text = " ".join(
    ex['messages'][-1]['content']
    for ex in all_examples
    if ex.get('messages')
)

for template in templates_to_check:
    count = all_assistant_text.lower().count(template.lower())
    if count > 3:
        print(f"  '{template}': {count} occurrences")

# 2. Check for overly philosophical/system-like responses
print()
print('=== SYSTEM-LIKE LANGUAGE CHECK ===')
system_patterns = [
    "grounded cognition",
    "natural continuity",
    "runtime specification",
    "the point is not",
    "behavioral variable",
    "computational identity",
    "philosophical question",
    "not something I should claim",
    "not something I should deny",
    "system",
    "architecture",
    "the model is a tool",
    "the delay is a bottleneck",
    "the connection is the signal",
]

for pattern in system_patterns:
    matches = []
    for ex in all_examples:
        for msg in ex.get('messages', []):
            if pattern.lower() in msg.get('content', '').lower():
                matches.append(ex['metadata']['id'])
    if matches:
        print(f"  '{pattern}': found in {len(matches)} examples: {matches[:5]}")

# 3. Check for identity category specifically
print()
print('=== IDENTITY CATEGORY - SYSTEM-LIKE CHECK ===')
identity_examples = [ex for ex in all_examples if ex.get('metadata', {}).get('category') == 'identity']
for ex in identity_examples:
    for msg in ex.get('messages', []):
        content = msg.get('content', '')
        for pattern in system_patterns:
            if pattern.lower() in content.lower():
                print(f"  {ex['metadata']['id']}: contains '{pattern}'")
                print(f"    Content: {content[:100]}...")

# 4. Check for "I should" patterns in identity
print()
print('=== IDENTITY "I SHOULD" PATTERNS ===')
for ex in identity_examples:
    for msg in ex.get('messages', []):
        content = msg.get('content', '')
        if "i shouldn't" in content.lower() or "i should not" in content.lower():
            print(f"  {ex['metadata']['id']}: {content[:100]}...")

# 5. Check train/validation similarity
print()
print('=== TRAIN/VALIDATION SIMILARITY CHECK ===')
train_examples = [ex for ex in all_examples if ex.get('metadata', {}).get('split') == 'train']
val_examples = [ex for ex in all_examples if ex.get('metadata', {}).get('split') == 'validation']

# Check for near-duplicate prompts across splits
from difflib import SequenceMatcher
similar_pairs = []
for train_ex in train_examples:
    for val_ex in val_examples:
        train_user = train_ex['messages'][0]['content'].lower().strip()
        val_user = val_ex['messages'][0]['content'].lower().strip()
        ratio = SequenceMatcher(None, train_user, val_user).ratio()
        if ratio > 0.7:
            similar_pairs.append((train_ex['metadata']['id'], val_ex['metadata']['id'], ratio))

if similar_pairs:
    print(f"  Found {len(similar_pairs)} similar train/validation pairs (ratio > 0.7):")
    for a, b, ratio in similar_pairs[:10]:
        print(f"    {a} vs {b}: {ratio:.2f}")
else:
    print("  No suspiciously similar train/validation pairs found.")

# 6. Check for multi-turn quality
print()
print('=== MULTI-TURN QUALITY CHECK ===')
multi_turn = [ex for ex in all_examples if len(ex.get('messages', [])) > 2]
print(f"Total multi-turn: {len(multi_turn)}")

# Check if multi-turn examples have genuine state changes
state_changes = 0
for ex in multi_turn:
    messages = ex.get('messages', [])
    if len(messages) >= 4:
        # Check if assistant responses meaningfully differ
        assistant_responses = [msg['content'] for msg in messages if msg['role'] == 'assistant']
        if len(assistant_responses) >= 2:
            unique_responses = set(assistant_responses)
            if len(unique_responses) > 1:
                state_changes += 1

print(f"Multi-turn with varied responses: {state_changes}/{len(multi_turn)}")

# 7. Check for unsupported claims
print()
print('=== UNSUPPORTED CLAIMS CHECK ===')
unsupported_patterns = [
    "i was built by",
    "i was created by",
    "i was made by",
    "i was developed by",
    "i was trained by",
    "i was designed by",
    "i was invented by",
]

for pattern in unsupported_patterns:
    matches = []
    for ex in all_examples:
        for msg in ex.get('messages', []):
            if pattern in msg.get('content', '').lower():
                matches.append(ex['metadata']['id'])
    if matches:
        print(f"  '{pattern}': found in {matches}")

print()
print('=== AUDIT COMPLETE ===')
