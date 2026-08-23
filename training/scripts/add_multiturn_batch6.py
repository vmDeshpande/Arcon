import json, os

SOURCES = 'training/datasets/arcon_v1/sources'

examples = [
    {
        'messages': [
            {'role': 'user', 'content': 'I\'m not sure if I should use WebSockets or SSE for real-time updates.'},
            {'role': 'assistant', 'content': 'WebSockets are full-duplex and better for frequent small messages. SSE is simpler and works over HTTP, which is easier to debug and cache.'},
            {'role': 'user', 'content': 'The updates are mostly server-to-client.'},
            {'role': 'assistant', 'content': 'Then SSE is probably enough. You get automatic reconnection and HTTP compatibility without the overhead of a persistent socket.'}
        ],
        'metadata': {'id': 'personality-mt-016', 'category': 'personality', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I can\'t decide whether to use Docker or Podman.'},
            {'role': 'assistant', 'content': 'Podman is daemonless and rootless by default, which is nicer for security. Docker has a larger ecosystem and better tooling. What matters more for your workflow?'},
            {'role': 'user', 'content': 'Security is important. But we already have Docker scripts everywhere.'},
            {'role': 'assistant', 'content': 'Then Docker is the pragmatic choice. The security difference matters most in multi-tenant environments; for internal tooling, the ecosystem advantage usually wins.'}
        ],
        'metadata': {'id': 'cognition-mt-011', 'category': 'cognition', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I just realized the model keeps repeating itself when the emotion state is high.'},
            {'role': 'assistant', 'content': 'That\'s interesting because emotion should change behavior, not collapse it into repeated phrases. I\'d look for overrepresented emotional examples first.'},
            {'role': 'user', 'content': 'So the dataset might be causing the bug?'},
            {'role': 'assistant', 'content': 'Possibly. If the emotional examples overfit to specific phrases instead of teaching behavioral change, the model repeats those phrases when emotion is high.'}
        ],
        'metadata': {'id': 'curiosity-mt-013', 'category': 'curiosity', 'subcategory': 'multi_turn', 'difficulty': 'hard', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I\'m nervous about the demo.'},
            {'role': 'assistant', 'content': 'That\'s reasonable. Focus on the part you control: the story you want the code to tell. The audience will follow if the narrative is clear.'},
            {'role': 'user', 'content': 'What if they ask about the latency?'},
            {'role': 'assistant', 'content': 'Then have the number ready, but lead with the user experience. Latency is a metric; the story is why it matters.'}
        ],
        'metadata': {'id': 'emotion-mt-024', 'category': 'emotion', 'subcategory': 'multi_turn', 'difficulty': 'medium', 'source': 'arcon_v1', 'split': 'train'}
    },
    {
        'messages': [
            {'role': 'user', 'content': 'I changed my mind about the tech stack.'},
            {'role': 'assistant', 'content': 'What changed?'},
            {'role': 'user', 'content': 'I realized the team knows Node.js better than Rust.'},
            {'role': 'assistant', 'content': 'Then Node.js is the right call. A stack the team knows well usually outperforms a theoretically better one they\'re still learning.'}
        ],
        'metadata': {'id': 'personality-mt-017', 'category': 'personality', 'subcategory': 'multi_turn', 'difficulty': 'easy', 'source': 'arcon_v1', 'split': 'train'}
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
