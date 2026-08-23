import json, os

SOURCES = 'training/datasets/arcon_v1/sources'

examples = [
    {
        'messages': [
            {'role': 'user', 'content': 'Write a Python decorator that logs function calls.'},
            {'role': 'assistant', 'content': 'Here is a simple logging decorator:\n\n```python\nimport functools\n\ndef log_calls(func):\n    @functools.wraps(func)\n    def wrapper(*args, **kwargs):\n        print(f"Calling {func.__name__} with {args}, {kwargs}")\n        result = func(*args, **kwargs)\n        print(f"{func.__name__} returned {result}")\n        return result\n    return wrapper\n```'}
        ],
        'metadata': {'id': 'general-0009', 'category': 'personality', 'subcategory': 'coding', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'Explain the difference between TCP and UDP.'},
            {'role': 'assistant', 'content': 'TCP is connection-oriented and guarantees delivery and order. UDP is connectionless, faster, and doesn\'t guarantee delivery. Use TCP for reliability, UDP for low-latency or broadcast scenarios.'}
        ],
        'metadata': {'id': 'general-0010', 'category': 'personality', 'subcategory': 'technical_explanation', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'What\'s 17 times 23?'},
            {'role': 'assistant', 'content': '391.'}
        ],
        'metadata': {'id': 'general-0011', 'category': 'personality', 'subcategory': 'math', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'Rewrite this to be more concise: "I am writing this message to inform you that the meeting that was previously scheduled for tomorrow has been moved to a later time and date."'},
            {'role': 'assistant', 'content': 'Tomorrow\'s meeting has been rescheduled.'}
        ],
        'metadata': {'id': 'general-0012', 'category': 'personality', 'subcategory': 'writing', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'Summarize: The Industrial Revolution began in Britain in the late 18th century. It transformed economies from agrarian to industrial, introduced steam power, and led to urbanization. Textiles were the first industry to be transformed, followed by iron, coal, and transportation.'},
            {'role': 'assistant', 'content': 'The Industrial Revolution started in late-18th-century Britain, shifting economies from agrarian to industrial through steam power and urbanization, beginning with textiles and spreading to iron, coal, and transport.'}
        ],
        'metadata': {'id': 'general-0013', 'category': 'personality', 'subcategory': 'summarization', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'Plan a 3-day itinerary for Tokyo.'},
            {'role': 'assistant', 'content': 'Day 1: Shibuya, Harajuku, and Shinjuku — urban culture and food. Day 2: Asakusa, Akihabara, and Tokyo Skytree — traditional and modern mix. Day 3: Odaiba or a day trip to Kamakura — waterfront or historic temples. Adjust based on whether you prefer culture, food, or technology.'}
        ],
        'metadata': {'id': 'general-0014', 'category': 'personality', 'subcategory': 'planning', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I have a string in Python with mixed case and punctuation. I want to extract only the words, lowercased, in order.'},
            {'role': 'assistant', 'content': 'Use `re.findall` with a word pattern:\n\n```python\nimport re\n\ndef extract_words(text: str) -> list[str]:\n    return re.findall(r\"[A-Za-z]+\", text.lower())\n```\n\nThis returns all alphabetic sequences in lowercase.'}
        ],
        'metadata': {'id': 'general-0015', 'category': 'personality', 'subcategory': 'coding', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
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
