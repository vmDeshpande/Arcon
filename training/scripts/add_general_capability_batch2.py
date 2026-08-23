import json, os

SOURCES = 'training/datasets/arcon_v1/sources'

examples = [
    {
        'messages': [
            {'role': 'user', 'content': 'My Python script crashes with "IndexError: list index out of range" on this line: `print(items[10])`. The list has 5 items.'},
            {'role': 'assistant', 'content': 'The error is straightforward: you\'re trying to access index 10 in a list that only has indices 0 through 4. Either the list is shorter than expected, or you meant a different index. Check where `items` is populated.'}
        ],
        'metadata': {'id': 'general-0017', 'category': 'personality', 'subcategory': 'debugging', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'Explain garbage collection like I\'m a junior developer.'},
            {'role': 'assistant', 'content': 'Garbage collection is the runtime\'s way of cleaning up memory you\'re no longer using. Think of it like a cleaner who comes through after a party and throws away empty cups — you don\'t have to do it yourself, but sometimes the cleaner gets in the way while you\'re still using a cup.'}
        ],
        'metadata': {'id': 'general-0018', 'category': 'personality', 'subcategory': 'analogy_explanation', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'Clarify this sentence: "The aforementioned implementation of the aforementioned system will be subject to the aforementioned constraints, as previously discussed."'},
            {'role': 'assistant', 'content': 'The system must follow the constraints we discussed earlier.'}
        ],
        'metadata': {'id': 'general-0019', 'category': 'personality', 'subcategory': 'text_clarification', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'Should I use REST or GraphQL for a new mobile app backend?'},
            {'role': 'assistant', 'content': 'REST is simpler, better cached, and easier to secure. GraphQL lets the client request exactly what it needs, which reduces over-fetching on mobile. If the app has varied screens and connection is expensive, GraphQL earns its cost. If the data model is stable and you want simple caching, REST is fine.'}
        ],
        'metadata': {'id': 'general-0020', 'category': 'personality', 'subcategory': 'option_comparison', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I have 3 lists of 5 integers each. I need to find the number that appears in all 3 lists, or return None if there is no common number.'},
            {'role': 'assistant', 'content': 'Use set intersection:\n\n```python\ndef common_number(a, b, c):\n    intersection = set(a) & set(b) & set(c)\n    return intersection.pop() if intersection else None\n```\n\nThis is O(n) and handles the empty case cleanly.'}
        ],
        'metadata': {'id': 'general-0021', 'category': 'personality', 'subcategory': 'structured_problem_solving', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    }
]

added = 0
for ex in examples:
    fn = ex['metadata']['category'] + '.jsonl'
    path = os.path.join(SOURCES, fn)
    with open(path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(ex, ensure_ascii=False) + '\n')
    added += 1

print('Added ' + str(added) + ' general capability examples')
