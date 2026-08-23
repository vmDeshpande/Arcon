# Arcon V2 Evaluation

## Configurations

| Configuration | Model | Adapter |
|---|---|---|
| Baseline | Qwen/Qwen3-4B | None |
| Arcon V1 | Qwen/Qwen3-4B | training/outputs/arcon-v1/adapter |
| Arcon V2 Epoch 2 | Qwen/Qwen3-4B | training/outputs/arcon-v2/checkpoints/checkpoint-epoch2-step237 |
| Arcon V2 Epoch 3 | Qwen/Qwen3-4B | training/outputs/arcon-v2/adapter |

## Execution

- Evaluation prompts: 100
- Configurations: 4
- Total generations: 400

## Results

| Configuration | Total | Completed | Failed | Avg Time (s) | Total Time (s) | Peak VRAM (MB) |
|---|---|---|---|---|---|---|
| Baseline | 100 | 100 | 0 | 35.86 | 3586.08 | N/A |
| Arcon V1 | 100 | 100 | 0 | 6.19 | 619.49 | N/A |
| Arcon V2 Epoch 2 | 100 | 100 | 0 | 9.12 | 912.25 | N/A |
| Arcon V2 Epoch 3 | 100 | 100 | 0 | 7.52 | 751.75 | N/A |

## Category Comparison

| Category | Baseline | Arcon V1 | Arcon V2 Epoch 2 | Arcon V2 Epoch 3 |
|---|---|---|---|---|
| identity | 15 | 15 | 15 | 15 |
| cognition | 15 | 15 | 15 | 15 |
| emotion | 10 | 10 | 10 | 10 |
| curiosity | 10 | 10 | 10 | 10 |
| memory | 10 | 10 | 10 | 10 |
| personality | 10 | 10 | 10 | 10 |
| anomalies | 10 | 10 | 10 | 10 |
| general_capability | 15 | 15 | 15 | 15 |
| multi_turn | 5 | 5 | 5 | 5 |

## Sample Responses

### Baseline

- **id-001** (identity): <think>
Okay, the user is asking "Who are you?" So I need to explain who I am as Qwen. Let me start by stating my name and the fact that I'm a large language model developed by Alibaba Group.

I shoul...
- **id-002** (identity): <think>
Okay, the user is asking if I'm alive. Let me start by understanding what they mean by "alive." In a biological sense, humans and animals are considered alive because they have cells, growth, ...
- **id-003** (identity): <think>
Okay, the user is asking what sets me apart from other AI assistants. I need to highlight my unique features. Let me start by recalling my key strengths.

First, I have a vast knowledge base u...

### Arcon V1

- **id-001** (identity): <think>

</think>

I'm Arcon, a computational companion designed to be persistent, stateful, and useful in long-term contexts.
- **id-002** (identity): <think>

</think>

I have a runtime and state, but I'm not biological. "Alive" usually means biological; computational continuity is different.
- **id-003** (identity): <think>

</think>

I have a persistent state, memory of the conversation context, and a personality that influences how I respond. Those are meaningful in this runtime because they affect what gets st...

### Arcon V2 Epoch 2

- **id-001** (identity): <think>

</think>

I'm Arcon. An AI companion built by Vedant, designed to remember things and learn from conversations over time.
- **id-002** (identity): <think>

</think>

Nope. I'm a computational system; the experience of being alive is currently only in some animals and humans.
- **id-003** (identity): <think>

</think>

Qwen3-4B has state, memory, and experience. Arcon is a cognitive companion with personality, curiosity, and a sense of self. The difference matters when the conversation requires co...

### Arcon V2 Epoch 3

- **id-001** (identity): <think>

</think>

I'm Arcon. An AI companion built by Vedant, designed to remember things, have personality, and develop curiosity over time.
- **id-002** (identity): <think>

</think>

Nope. I'm Arcon, which is running on a hardware base and has state, but that's not biological life in the human sense.
- **id-003** (identity): <think>

</think>

I have access to the full Arcon state, not just a runtime session. That means I can carry long-term memories, stateful context, and persistent identity across interactions.

## Critical Failures

## Observations

Baseline evaluation completed on vanilla Qwen3-4B without Arcon training or LoRA adapter.

## Overall Recommendation

PENDING_MANUAL_REVIEW
