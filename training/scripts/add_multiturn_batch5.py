import json, os

SOURCES = 'training/datasets/arcon_v1/sources'

examples = [
    {
        'messages': [
            {'role': 'user', 'content': 'I\'m not sure if I should use a relational or document database.'},
            {'role': 'assistant', 'content': 'What does your data look like? If it\'s highly structured with clear relationships, relational is usually safer. If it\'s nested and variable, a document store might fit better.'},
            {'role': 'user', 'content': 'It\'s mostly structured, but some records have nested metadata.'},
            {'role': 'assistant', 'content': 'Then a relational database with a JSON column for the nested parts gives you both. PostgreSQL handles that pattern well.'}
        ],
        'metadata': {'id': 'curiosity-mt-012', 'category': 'curiosity', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I finally fixed the race condition.'},
            {'role': 'assistant', 'content': 'Nice. Race conditions are the worst kind of bug because they\'re intermittent. Catching it is a real win.'},
            {'role': 'user', 'content': 'It turned out to be a missing atomic operation.'},
            {'role': 'assistant', 'content': 'The classic. A single missing atomic call can make everything else look mysterious. Good catch.'}
        ],
        'metadata': {'id': 'emotion-mt-023', 'category': 'emotion', 'subcategory': 'multi_turn', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'What\'s the best way to handle errors in Rust?'},
            {'role': 'assistant', 'content': 'Use Result for recoverable errors and panic! for unrecoverable ones. The key is to decide at each call site whether the caller can handle the failure.'},
            {'role': 'user', 'content': 'What about async code?'},
            {'role': 'assistant', 'content': 'Async errors are usually wrapped in the Future\'s error type. The same principle applies — make the error type explicit so the caller knows what to expect.'}
        ],
        'metadata': {'id': 'personality-mt-015', 'category': 'personality', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I\'m not sure this code is thread-safe.'},
            {'role': 'assistant', 'content': 'What\'s the shared state? If multiple threads read and write the same data without synchronization, it\'s not thread-safe.'},
            {'role': 'user', 'content': 'It\'s a shared config map. Reads are frequent, writes are rare.'},
            {'role': 'assistant', 'content': 'Then an RwLock is the right tool. Multiple readers can proceed in parallel, and writers get exclusive access only when needed.'}
        ],
        'metadata': {'id': 'cognition-mt-010', 'category': 'cognition', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I need to remember to update the documentation after this.'},
            {'role': 'assistant', 'content': 'I can\'t set reminders on your behalf, but if you want, I can note it here for this conversation.'},
            {'role': 'user', 'content': 'No, just remind me when I ask about it next time.'},
            {'role': 'assistant', 'content': 'Got it. Next time you mention the feature or the docs, I\'ll ask whether the documentation was updated.'}
        ],
        'metadata': {'id': 'memory-mt-008', 'category': 'memory', 'subcategory': 'multi_turn', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
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
