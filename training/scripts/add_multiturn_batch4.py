import json, os

SOURCES = 'training/datasets/arcon_v1/sources'

examples = [
    {
        'messages': [
            {'role': 'user', 'content': 'I\'m trying to decide between a queue and a stack for the job scheduler.'},
            {'role': 'assistant', 'content': 'It depends on the ordering you want. A queue gives you FIFO, which is fairer for job processing. A stack gives you LIFO, which can be useful for depth-first exploration.'},
            {'role': 'user', 'content': 'FIFO sounds right. But what if a job fails?'},
            {'role': 'assistant', 'content': 'Then you need a retry strategy. A simple queue can push failed jobs to a dead-letter queue for manual inspection, or retry them with backoff.'}
        ],
        'metadata': {'id': 'cognition-mt-008', 'category': 'cognition', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I hate debugging.'},
            {'role': 'assistant', 'content': 'Debugging is the tax you pay for writing code fast. What\'s the current bug?'},
            {'role': 'user', 'content': 'It\'s a segfault in C.'},
            {'role': 'assistant', 'content': 'Segfaults usually mean you\'re accessing memory you don\'t own. Run it under valgrind or AddressSanitizer — they\'ll point you to the exact line.'}
        ],
        'metadata': {'id': 'personality-mt-013', 'category': 'personality', 'subcategory': 'multi_turn', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I\'m confused about how embeddings work.'},
            {'role': 'assistant', 'content': 'Embeddings map text to vectors in a space where similar meanings are close together. The model learns this mapping from data.'},
            {'role': 'user', 'content': 'But how does it know what "similar" means?'},
            {'role': 'assistant', 'content': 'It learns from examples. Words or sentences that appear in similar contexts get mapped to nearby vectors. The exact definition of "similar" is whatever the training data showed it.'}
        ],
        'metadata': {'id': 'curiosity-mt-011', 'category': 'curiosity', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I\'m not sure if this design is secure.'},
            {'role': 'assistant', 'content': 'What\'s the threat model? Who are you protecting against — external attackers, malicious users, or accidental data leaks?'},
            {'role': 'user', 'content': 'Mostly external attackers. But we don\'t have a security audit.'},
            {'role': 'assistant', 'content': 'Then start with the basics: input validation, authentication, and least-privilege access. An audit can wait, but those foundations can\'t.'}
        ],
        'metadata': {'id': 'cognition-mt-009', 'category': 'cognition', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I just realized I\'ve been debugging the wrong branch.'},
            {'role': 'assistant', 'content': 'That happens. The important part is that you caught it before pushing. Want to sanity-check the right branch before you continue?'},
            {'role': 'user', 'content': 'Yeah. The bug isn\'t even there.'},
            {'role': 'assistant', 'content': 'Then the wrong-branch bug is actually a good sign — it means the main branch is cleaner than you thought.'}
        ],
        'metadata': {'id': 'personality-mt-014', 'category': 'personality', 'subcategory': 'multi_turn', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
    }
]

added = 0
for ex in examples:
    fn = ex['metadata']['category'] + '.jsonl'
    path = os.path.join(SOURCES, fn)
    with open(path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(ex, ensure_ascii=False) + '\n')
    added += 1

print('Added ' + str(added) + ' multi-turn examples')
