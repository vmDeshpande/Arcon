# Arcon Training Dataset V1

## Purpose

This is the first behavioral foundation dataset for Arcon.

It teaches Qwen3-4B foundational patterns required for Arcon's cognitive architecture:
identity, cognitive behavior, emotional behavior, curiosity, memory behavior, personality, and anomaly handling.

This is NOT the final Arcon dataset.
This is NOT intended to create a fully autonomous Arcon.
This is an experimental starting point to answer whether Qwen3-4B can be behaviorally adapted toward Arcon.

## Structure

```
training/datasets/arcon_v1/
├── sources/
│   ├── identity.jsonl
│   ├── cognition.jsonl
│   ├── emotion.jsonl
│   ├── curiosity.jsonl
│   ├── memory.jsonl
│   ├── personality.jsonl
│   └── anomalies.jsonl
├── train.jsonl
├── validation.jsonl
├── dataset_manifest.json
└── README.md
```

## Schema

Each example follows this structure:

```json
{
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "metadata": {
    "id": "identity-0001",
    "category": "identity",
    "subcategory": "name",
    "difficulty": "easy",
    "source": "arcon_v1",
    "split": "train"
  }
}
```

## Categories

- identity — Arcon's self-concept, creator, purpose, persistence
- cognition — reasoning, uncertainty, ambiguity, anti-fabrication
- emotion — user emotion vs Arcon emotion, transitions, state honesty
- curiosity — question formation, selectivity, grounded investigation
- memory — grounding, missing details, corrections, conversation history
- personality — natural conversation, disagreement, opinions, technical capability
- anomalies — unexpected inputs, contradictions, topic switches, edge cases

## Train / Validation Split

- Train: 237 examples
- Validation: 91 examples
- Total: 328 examples

Split is deterministic and category-balanced.
Validation examples are non-trivial paraphrases or distinct situations from training examples.

## Design Philosophy

- Quality over quantity
- Behavior over scripts
- No fake memories
- No autonomous capabilities pretended
- No chain-of-thought transcripts
- General capabilities preserved (coding, reasoning, knowledge)
- Negative examples included to correct known failure patterns

## What Dataset V1 Does NOT Teach

- Internet access or autonomous browsing
- Self-modification of weights
- Autonomous self-retraining
- Real Arcon memories or personal data
- Final Arcon personality
- Voice-specific behavior
- Agentic tool execution

## Limitations

- Small size (70 examples)
- Limited multi-turn depth
- Synthetic scenarios, not real Arcon conversations
- Human review still required
- Does not cover all specification categories

## Validation

Run:

```
python training/scripts/validate_arcon_dataset.py
```

Validation report: `training/outputs/test/arcon-dataset-v1-validation.txt`

## Next Steps

1. Human review of Dataset V1
2. Baseline evaluation of Qwen3-4B against dataset
3. First QLoRA training run
4. Failure analysis
5. Iterative dataset expansion
