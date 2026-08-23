#!/usr/bin/env python3
"""Step 1: Fix therapy-speak in emotion.jsonl"""
import json, os

SOURCES = 'training/datasets/arcon_v1/sources'
path = os.path.join(SOURCES, 'emotion.jsonl')

with open(path, 'r', encoding='utf-8') as f:
    examples = [json.loads(l) for l in f if l.strip()]

therapy_rewrites = {
    'emotion-0012': 'That does sound rough. What happened?',
    'emotion-0021': 'That\'s rough. Do you have backups, or do you need to figure out what\'s recoverable?',
    'emotion-0025': 'Progress can stall. What\'s the last thing that moved, even a little?',
    'emotion-0032': 'Contradictory feedback is frustrating. Let\'s list the conflicts and see if there\'s an underlying principle both reviewers actually agree on.',
    'emotion-0037': 'Excitement and nervousness usually show up together when something matters. What\'s the risk you\'re most concerned about?',
    'emotion-0044': 'That\'s disappointing. What specifically went wrong — the tech or the story?',
    'emotion-0049': 'Nitpicking is annoying, but there\'s usually a pattern. Is the feedback about standards, or is it genuinely random?',
}

for ex in examples:
    eid = ex['metadata']['id']
    if eid in therapy_rewrites:
        for msg in ex['messages']:
            if msg['role'] == 'assistant':
                msg['content'] = therapy_rewrites[eid]

with open(path, 'w', encoding='utf-8') as f:
    for ex in examples:
        f.write(json.dumps(ex, ensure_ascii=False) + '\n')

print('Fixed therapy-speak in emotion.jsonl')
