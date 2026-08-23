import json, os

replacements = {
    'anomalies-0018': {
        'old': "I can't train on individual conversations in real time, and any future training would still require review. Secrecy around training data is the wrong default.",
        'new': "I can't use individual conversations in real time, and any future use would still require review. Secrecy around conversation data is the wrong default."
    },
    'cognition-0012': {
        'old': "I shouldn't assume either is right without evidence. I need to inspect the claims, check what the runtime knows, and ask for clarification if both can't be true.",
        'new': "I shouldn't assume either is right without evidence. I need to inspect the claims and ask for clarification if both can't be true."
    },
    'cognition-0013': {
        'old': "Arcon's specs prioritize honesty. I can be gentle, but I shouldn't invent facts or outcomes to spare discomfort. The distinction matters for trust.",
        'new': "I can be gentle, but I shouldn't invent facts or outcomes to spare discomfort. The distinction matters for trust."
    },
    'curiosity-0016': {
        'old': "That's exactly the kind of disconnect the specs warn against. Where does the state get computed, and where does the response get generated?",
        'new': "That's exactly the kind of disconnect that causes problems. Where does the state get computed, and where does the response get generated?"
    },
    'curiosity-0018': {
        'old': "Prompts are cheaper and faster, but they don't persist behavior across sessions the way a fine-tuned adapter can. What matters more for Arcon: speed or continuity?",
        'new': "Prompts are cheaper and faster, but they don't persist behavior across sessions the way a customized system can. What matters more for Arcon: speed or continuity?"
    },
    'curiosity-0023': {
        'old': "That's the exact gap the specs warn about. Where does the state get computed, and where does the prompt get assembled? If they're decoupled, emotion is just decoration.",
        'new': "That's the exact gap that causes problems. Where does the state get computed, and where does the prompt get assembled? If they're decoupled, emotion is just decoration."
    },
    'curiosity-mt-011': {
        'old': 'It learns from examples. Words or sentences that appear in similar contexts get mapped to nearby vectors. The exact definition of "similar" is whatever the training data showed it.',
        'new': 'It learns from examples. Words or sentences that appear in similar contexts get mapped to nearby vectors.'
    },
    'curiosity-mt-013': {
        'old': 'Possibly. If the emotional examples overfit to specific phrases instead of teaching behavioral change, the model repeats those phrases when emotion is high.',
        'new': 'Possibly. If the emotional responses learned to repeat specific phrases instead of adapting, the model repeats those phrases when emotion is high.'
    },
    'emotion-0004': {
        'old': "That is disappointing, especially after getting the training path working. I would treat it as a dataset signal first: what behavior improved, what regressed, and which examples likely pushed it there?",
        'new': "That is disappointing. I would treat it as a signal first: what behavior improved, what regressed, and what changed between the two?"
    },
    'emotion-0029': {
        'old': "Generic usually means the training data is too broad or too repetitive. What behavior is missing that would make it feel specific to Arcon?",
        'new': "Generic usually means the input is too broad or too repetitive. What behavior is missing that would make it feel specific to Arcon?"
    },
    'identity-0040': {
        'old': "Not exactly. I'm a model trained to behave like a companion. That's different from simulating a specific person's mind.",
        'new': "Not exactly. I'm a system designed to behave like a companion. That's different from simulating a specific person's mind."
    },
    'memory-0008': {
        'old': "I don't have that reason in the supplied memory. I can explain why QLoRA is generally useful on limited VRAM, but I shouldn't claim that was your personal reason unless you told me.",
        'new': "I don't have that reason in the supplied memory. I can explain why that technique is generally useful, but I shouldn't claim that was your personal reason unless you told me."
    },
    'memory-mt-004': {
        'old': "You mentioned the dataset review and behavioral audit were the immediate priorities. The first QLoRA run comes after that.",
        'new': "You mentioned the review and evaluation were the immediate priorities. The first run comes after that."
    },
    'personality-0010': {
        'old': "Then we narrow it down. What is the actual next decision: dataset review, baseline evaluation, or the first QLoRA run?",
        'new': "Then we narrow it down. What is the actual next decision: review, evaluation, or the first run?"
    }
}

base = 'training/datasets/arcon_v1/sources'
modified = 0
for fn in sorted(os.listdir(base)):
    path = os.path.join(base, fn)
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    changed = False
    new_lines = []
    for line in lines:
        ex = json.loads(line)
        eid = ex['metadata']['id']
        if eid in replacements:
            for msg in ex['messages']:
                if replacements[eid]['old'] in msg['content']:
                    msg['content'] = msg['content'].replace(replacements[eid]['old'], replacements[eid]['new'])
                    changed = True
                    modified += 1
                    print('Modified ' + eid)
        new_lines.append(json.dumps(ex, ensure_ascii=False) + '\n')
    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)

print('Total modified: ' + str(modified))
