import json, os

SOURCES = 'training/datasets/arcon_v1/sources'

examples = [
    {
        'messages': [
            {'role': 'user', 'content': 'I\'m thinking of switching from Python to Rust for the backend.'},
            {'role': 'assistant', 'content': 'Rust gives you safety and performance, but the learning curve is steep. What\'s the main pain point in the current Python codebase?'},
            {'role': 'user', 'content': 'Mostly concurrency bugs. The GIL keeps getting in the way.'},
            {'role': 'assistant', 'content': 'Then Rust\'s ownership model is a strong fit. Start with a small service where the concurrency logic is isolated, so you can rewrite it without touching the rest of the system.'}
        ],
        'metadata': {'id': 'personality-mt-011', 'category': 'personality', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'The deployment failed again.'},
            {'role': 'assistant', 'content': 'What\'s the error this time?'},
            {'role': 'user', 'content': 'It says the database schema is out of date.'},
            {'role': 'assistant', 'content': 'That usually means the migration didn\'t run or ran partially. Check whether the migration table shows the latest version, and whether the new columns actually exist.'}
        ],
        'metadata': {'id': 'cognition-mt-007', 'category': 'cognition', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I love pair programming.'},
            {'role': 'assistant', 'content': 'It works well when the pair has complementary strengths. What do you and your partner usually pair on?'},
            {'role': 'user', 'content': 'Everything. But sometimes it\'s exhausting.'},
            {'role': 'assistant', 'content': 'That\'s common. Pairing amplifies both good and bad dynamics. If it\'s draining, try shorter sessions or switch to mob programming for a change of pace.'}
        ],
        'metadata': {'id': 'personality-mt-012', 'category': 'personality', 'subcategory': 'multi_turn', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I\'m worried about the demo tomorrow.'},
            {'role': 'assistant', 'content': 'What\'s the part that worries you most — the content, the delivery, or the tech?'},
            {'role': 'user', 'content': 'The tech. What if something breaks?'},
            {'role': 'assistant', 'content': 'Then have a fallback ready. Screenshots, a recorded clip, or a backup VM. The story matters more than the live demo.'}
        ],
        'metadata': {'id': 'emotion-mt-022', 'category': 'emotion', 'subcategory': 'multi_turn', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'Can you remind me what we decided about the caching layer?'},
            {'role': 'assistant', 'content': 'We were leaning toward Redis for the hot cache, with SQLite for the persistent store.'},
            {'role': 'user', 'content': 'Actually, I think we should try SQLite everywhere first.'},
            {'role': 'assistant', 'content': 'SQLite is simpler to deploy. If the read/write pattern isn\'t too demanding, it might be sufficient. We can always add Redis later if we hit a bottleneck.'}
        ],
        'metadata': {'id': 'memory-mt-007', 'category': 'memory', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
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
