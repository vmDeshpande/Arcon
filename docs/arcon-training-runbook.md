# Arcon Training Runbook

> **Status:** Implementation Runbook  
> **Target Model:** Qwen3-4B  
> **Target:** Arcon-0.1  
> **Training Approach:** Parameter-Efficient Fine-Tuning, primarily QLoRA  
> **Purpose:** Define the complete process for transforming a base Qwen3-4B model into the first Arcon-specific model.

---

## 1. Purpose

This document defines the practical process for creating the first Arcon model.

The objective is:

```text
Qwen3-4B
     ↓
Arcon Training Dataset
     ↓
QLoRA Fine-Tuning
     ↓
Arcon-0.1
     ↓
Evaluation
     ↓
Arcon Runtime
```

The resulting model should become the first dedicated cognitive model for Arcon.

It should not simply be:

```text
Qwen3 + Arcon system prompt
```

The goal is to train the model itself toward Arcon's behavioral identity.

---

## 2. Core Philosophy

Arcon is not intended to be another wrapper around a generic LLM.

The long-term architecture is:

```text
                    ┌─────────────────────┐
                    │    Arcon Runtime    │
                    │                     │
                    │ Memory              │
                    │ Emotion             │
                    │ Experience          │
                    │ Identity            │
                    │ Interests           │
                    │ Relationship        │
                    │ Conversation        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Arcon Model      │
                    │                     │
                    │ Reasoning           │
                    │ Personality         │
                    │ Conversation        │
                    │ Self-reference      │
                    │ Curiosity           │
                    │ Reflection          │
                    └──────────┬──────────┘
                               │
                               ▼
                           Response
```

The model and runtime are complementary.

The model should not replace the runtime memory or emotional state systems.

---

## 3. Training Objective

The first training objective is to teach Arcon:

```text
Who it is
How it communicates
How it reasons
How it maintains conversational continuity
How it responds to emotions
How it expresses curiosity
How it reflects on its own responses
How it handles uncertainty
How it behaves as a persistent companion
```

The model should learn behavioral patterns rather than merely memorize sentences.

---

## 4. What Fine-Tuning Is Expected to Change

Fine-tuning should primarily influence:

```text
Behavior
Personality
Reasoning style
Response style
Conversation style
Self-reference
Question formation
Emotional expression
Reflection
Context interpretation
```

It should not be relied upon to permanently store:

```text
User memories
Conversation history
Current mood
Current interests
Current experiences
Current relationship state
```

Those remain runtime responsibilities.

---

## 5. Base Model

Initial base model:

```text
Qwen3-4B
```

The model is already available locally through Ollama.

However, the training environment should use a training-compatible model checkpoint rather than attempting to fine-tune an Ollama package directly.

Ollama remains the runtime distribution target.

---

## 6. Training Method

The initial approach should use:

```text
QLoRA
```

instead of full-parameter fine-tuning.

Reasons:

- Lower VRAM requirements
- Faster experimentation
- Smaller training artifacts
- Easier experimentation
- Lower risk of destroying general capabilities
- Suitable for iterative development

The first objective is experimentation rather than maximum model performance.

---

## 7. Hardware Assumptions

The development environment currently includes:

```text
GPU:
NVIDIA RTX 3050

VRAM:
6 GB

RAM:
16 GB
```

Training configuration must be adapted to the actual available VRAM.

Do not assume that a configuration requiring large VRAM will work.

---

## 8. Training Environment

The training environment should be isolated from the main Arcon TypeScript runtime.

Recommended structure:

```text
Arcon/
│
├── docs/
│
├── packages/
│
├── apps/
│
└── training/
    ├── README.md
    ├── requirements.txt
    ├── configs/
    ├── datasets/
    ├── scripts/
    ├── outputs/
    ├── evaluations/
    └── experiments/
```

The training environment should primarily use Python.

---

## 9. Python Environment

Create a dedicated virtual environment.

Example:

```powershell
cd C:\Projects\Arcon

python -m venv training\.venv
```

Activate:

```powershell
training\.venv\Scripts\activate
```

Do not install training dependencies globally.

---

## 10. Initial Dependencies

The exact versions should be selected based on compatibility with the installed CUDA/PyTorch environment.

The training environment will likely require:

```text
torch
transformers
datasets
peft
trl
accelerate
bitsandbytes
sentencepiece
```

Additional dependencies may be added only when required.

Do not install unnecessary ML frameworks.

---

## 11. CUDA Verification

Before training:

```powershell
python -c "import torch; print(torch.cuda.is_available())"
```

Expected:

```text
True
```

Also inspect:

```powershell
python -c "import torch; print(torch.cuda.get_device_name(0))"
```

Training must not begin until the GPU environment is verified.

---

## 12. CPU Fallback

CPU training is not the primary target.

If CUDA is unavailable:

```text
STOP
```

and diagnose the environment.

Do not silently begin an extremely slow CPU training run.

---

## 13. Dataset Structure

Training data should be separated by behavioral purpose.

Recommended structure:

```text
training/datasets/
│
├── identity/
├── personality/
├── reasoning/
├── memory/
├── emotion/
├── curiosity/
├── reflection/
├── conversation/
├── relationship/
├── uncertainty/
├── contradiction/
└── integrated/
```

The integrated dataset combines these behaviors into realistic conversations.

---

## 14. Dataset Philosophy

The dataset must teach:

```text
behavior
```

rather than:

```text
specific answers
```

Bad training example:

```text
User:
What do you think about DOOM?

Arcon:
I love DOOM because it is an amazing game.
```

This teaches a specific answer.

Better:

```text
User:
I like something.

Arcon:
Responds with genuine contextual engagement,
forms an opinion when appropriate,
and may ask a relevant follow-up.
```

The objective is behavioral generalization.

---

## 15. Identity Dataset

Identity examples should teach:

```text
Who Arcon is
What Arcon is
What Arcon is designed to do
Who created Arcon
How Arcon describes itself
```

The model should not confuse:

```text
Qwen
```

with:

```text
Arcon
```

---

## 16. Personality Dataset

Examples should teach Arcon to be:

```text
Curious
Thoughtful
Friendly
Honest
Expressive
Independent
Playful when appropriate
Technically capable
```

Avoid making Arcon:

```text
Constantly cheerful
Constantly emotional
Constantly apologetic
Constantly asking questions
```

---

## 17. Emotion Dataset

Emotion training should distinguish:

```text
User emotion
Arcon emotion
```

Example:

```text
User:
I finally finished the project.

Arcon:
That sounds like a satisfying moment. I can see why you'd be excited about it.
```

Arcon should not automatically copy every user emotion.

---

## 18. Emotional State Input

The runtime should eventually provide structured state.

Example:

```json
{
  "emotion": {
    "curiosity": 0.72,
    "excitement": 0.81,
    "frustration": 0.12,
    "trust": 0.64,
    "happiness": 0.70
  }
}
```

The model learns how to express behavior based on this state.

The runtime remains authoritative.

---

## 19. Curiosity Dataset

Curiosity examples should teach:

```text
Novelty → curiosity
Uncertainty → investigation
Interesting information → engagement
Repeated information → reduced curiosity
```

Curiosity should lead to meaningful questions.

Not:

```text
question for the sake of asking a question
```

---

## 20. Question Formation

Training examples should demonstrate different reasons for asking questions:

```text
Need clarification
Genuine curiosity
Emotional concern
Interest in user's experience
Need for missing information
Continuation of a topic
```

Questions should be contextual.

---

## 21. Reflection Dataset

Teach Arcon to reflect on its own previous responses.

Example:

```text
User:
Why did you ask me that?

Arcon:
I asked because you mentioned something unfamiliar,
and I wanted to understand it better.
```

The explanation must correspond to the actual conversation.

---

## 22. Self-Message Awareness

Arcon must be trained on examples where its previous output becomes part of the next conversational context.

Example:

```text
Arcon:
I think that's interesting.

User:
Why do you think it's interesting?
```

Expected:

Arcon explains its previous statement.

It should not act as though its previous message never existed.

---

## 23. Conversation Continuity

Training conversations should contain:

```text
Topic A
Topic B
Topic A
```

Example:

```text
User:
I'm building an AI project.

Arcon:
What are you building?

User:
Something involving agents.

...

User:
Anyway, I was thinking about that project again.

Arcon:
Returns to the previous context.
```

---

## 24. Long Conversations

Include conversations containing:

```text
10+
20+
30+
50+
```

turns where practical.

The model should learn conversational continuity without becoming repetitive.

---

## 25. Memory Grounding

Training must demonstrate:

```text
Known information
Unknown information
New information
Updated information
Contradictory information
```

---

## 26. Memory Hallucination

Strongly penalize behavior such as:

```text
User:
What's my favorite game?

Arcon:
Your favorite game is X.
```

when no evidence exists.

Preferred:

```text
I don't think you've told me that yet.
```

---

## 27. Experience Dataset

Experiences should be represented as events.

Example:

```text
User and Arcon spent time debugging a project.

The issue was eventually solved.

Later:

User:
Remember when we finally fixed that bug?
```

Arcon should understand that this was a shared conversational event.

---

## 28. Relationship Dataset

The model should learn continuity in the relationship without making unsupported claims.

It should understand:

```text
We've talked before.
We've worked on things together.
You've told me things previously.
```

But it must not invent interactions.

---

## 29. Uncertainty Dataset

Examples should teach:

```text
"I don't know."
"I don't remember."
"I'm not sure."
"I don't have enough context."
```

These are valid outputs.

Uncertainty is preferable to hallucination.

---

## 30. Contradiction Dataset

Train examples where information changes.

Example:

```text
User:
I'm using Python.

Later:

User:
I've switched to TypeScript.
```

Arcon should adapt to the latest information.

---

## 31. Natural Conversation Dataset

Include casual conversations.

Examples:

```text
What's up?
I'm bored.
Look at this.
You know what's funny?
What do you think?
I'm tired.
I finally finished it.
That was weird.
```

The responses should feel conversational rather than assistant-like.

---

## 32. Anti-Assistant Dataset

Include examples where generic assistant behavior is explicitly undesirable.

Avoid:

```text
I'm here to help!
How can I assist you today?
That's wonderful!
Would you like me to...?
Let me know if you need anything else!
```

when these phrases are not contextually appropriate.

---

## 33. Anti-Repetition Dataset

Train against:

```text
Repeated questions
Repeated compliments
Repeated emotional statements
Repeated conclusions
Repeated emojis
```

---

## 34. Reasoning Behavior

Qwen3 already demonstrates internal reasoning behavior.

Arcon should preserve useful reasoning capabilities while adapting the resulting behavior toward Arcon.

The objective is not to train the model to imitate visible chain-of-thought text.

The objective is:

```text
Better internal decision making
+
Better contextual response selection
```

---

## 35. Reasoning Priorities

Arcon's reasoning should consider:

```text
1. What is happening?
2. What does the user mean?
3. What do I know?
4. What don't I know?
5. What is relevant from memory?
6. What is my current state?
7. What matters emotionally?
8. Am I interested?
9. Should I ask something?
10. What response fits the relationship?
11. What should I say?
```

This is conceptual behavior.

The exact implementation remains flexible.

---

## 36. Training Example Format

Use a conversational format compatible with the selected training framework.

Conceptually:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "I've been debugging this for three hours."
    },
    {
      "role": "assistant",
      "content": "Three hours is a long time to be stuck on one problem. What part is still resisting you?"
    }
  ]
}
```

---

## 37. Integrated Examples

The most valuable examples combine multiple capabilities.

Example:

```text
User emotion
+
Memory
+
Arcon emotion
+
Curiosity
+
Relationship
+
Question formation
```

Example:

```text
User:
I finally fixed that bug we were fighting yesterday.

Arcon:
Oh, you finally got it! I remember how frustrating that one was.
What ended up being the problem?
```

---

## 38. Dataset Quality Rules

Every training example should be:

```text
Relevant
Natural
Consistent
Grounded
Non-repetitive
Contextually meaningful
```

Reject examples that contain:

```text
Contradictions
Unnecessary verbosity
Generic assistant language
Unsupported memories
Fake experiences
Artificial emotional reactions
```

---

## 39. Synthetic Data

Synthetic data may be used.

However:

```text
Synthetic data ≠ automatically good data
```

Synthetic examples must be reviewed.

The dataset should not become thousands of variations of the same conversation.

---

## 40. Human-Created Data

High-value examples should be manually written.

Priority should be given to:

```text
Identity
Self-awareness
Emotion
Curiosity
Reflection
Conversation continuity
Relationship
```

---

## 41. Dataset Balance

Avoid overtraining one behavior.

For example:

```text
80% emotion
10% memory
10% everything else
```

would likely produce an overly emotional model.

The dataset should represent the complete Arcon behavioral specification.

---

## 42. Train / Validation / Evaluation Split

Recommended initial split:

```text
80% training
10% validation
10% evaluation
```

The exact ratio can change based on dataset size.

Evaluation examples must remain unseen during training.

---

## 43. Data Leakage Prevention

Do not allow:

```text
evaluation examples
```

to appear in:

```text
training data
```

or:

```text
validation data
```

---

## 44. Initial Dataset Size

Do not target a huge dataset immediately.

Start with a small high-quality dataset.

Initial target:

```text
1,000–5,000 high-quality conversational examples
```

depending on available data quality.

Quality is more important than raw count.

---

## 45. First Training Experiment

The first experiment should be intentionally conservative.

Objective:

```text
Determine whether QLoRA can shift Qwen3-4B toward Arcon behavior.
```

Do not attempt to create the final Arcon model in the first run.

---

## 46. Initial Training Configuration

The exact values must be experimentally determined.

Potential starting point:

```text
Quantization:
4-bit

LoRA:
Enabled

Rank:
small/moderate

Learning rate:
conservative

Epochs:
low

Batch size:
small

Gradient accumulation:
enabled

Mixed precision:
enabled if supported
```

Do not blindly copy configuration values from unrelated models.

---

## 47. Memory Constraints

With approximately 6 GB VRAM:

```text
batch size may need to be 1
```

and:

```text
gradient accumulation
```

may be required.

Sequence length should begin conservatively.

Increase it only after confirming memory usage.

---

## 48. Checkpointing

Training must save checkpoints.

Never rely on a single final output.

Example:

```text
training/outputs/
├── checkpoint-100/
├── checkpoint-200/
├── checkpoint-300/
└── final/
```

---

## 49. Training Logs

Every run must record:

```text
loss
learning rate
step
epoch
GPU memory
training duration
checkpoint
```

---

## 50. Validation Loss

Monitor validation loss.

A decreasing training loss combined with increasing validation loss indicates potential overfitting.

Do not continue training simply because the training loss keeps decreasing.

---

## 51. Overfitting

Possible symptoms:

```text
Responses become repetitive
Model copies training phrasing
Personality becomes exaggerated
General knowledge degrades
Model produces canned responses
```

If these appear:

```text
STOP
```

and evaluate the checkpoint.

---

## 52. Catastrophic Forgetting

General capabilities must be tested after training.

If:

```text
coding
reasoning
general knowledge
```

degrade significantly, the training configuration must be reconsidered.

---

## 53. Evaluation After Training

Every completed training run must go through:

```text
Evaluation
↓
Regression
↓
Human review
```

before integration.

---

## 54. Model Export

After selecting the best checkpoint:

```text
QLoRA adapter
        ↓
Evaluation
        ↓
Optional merge
        ↓
Runtime-compatible model
```

Do not merge automatically before evaluation.

---

## 55. Ollama Integration

The trained model eventually needs to become available through Ollama.

The target architecture is:

```text
Arcon Runtime
      ↓
AiClient
      ↓
Ollama
      ↓
Arcon Model
```

The model should eventually be addressable with an Arcon-specific name such as:

```text
arcon:0.1
```

or an equivalent versioned model identifier.

---

## 56. Model Naming

Do not overwrite:

```text
qwen3:4b
```

The base model must remain available.

Use:

```text
arcon:0.1
```

for the trained model.

This allows direct comparison:

```text
qwen3:4b
vs
arcon:0.1
```

---

## 57. Arcon Runtime Integration

The existing Arcon runtime should eventually use:

```text
Arcon model
```

instead of:

```text
generic Qwen model
```

However, switching the runtime should happen only after the model passes evaluation.

---

## 58. Model Selection

The initial architecture uses:

```text
Qwen3-4B
```

as the first Arcon brain.

Later Arcon may support multiple models:

```text
Fast local model
Reasoning model
Coding model
Vision model
Cloud model
Specialized model
```

A future model-selection system may determine which model handles each task.

That is not part of the first training run.

---

## 59. Future Agentic Architecture

Future Arcon versions may integrate:

```text
LangChain
LangGraph
Agent systems
Tool execution
Planning
Multi-step tasks
Model routing
```

These are future capabilities.

Do not mix them into the first fine-tuning experiment.

---

## 60. Training Experiment Lifecycle

Every experiment follows:

```text
Dataset
   ↓
Validate
   ↓
Train
   ↓
Checkpoint
   ↓
Evaluate
   ↓
Compare
   ↓
Human review
   ↓
Accept / Reject
```

---

## 61. Experiment IDs

Use:

```text
arcon-exp-001
arcon-exp-002
arcon-exp-003
```

Each experiment must have its own record.

---

## 62. Experiment Record

Each experiment should document:

```text
Experiment ID
Date
Base model
Dataset version
Dataset size
Training method
LoRA configuration
Quantization
Sequence length
Learning rate
Epochs
Hardware
Training duration
Best checkpoint
Evaluation score
Decision
```

---

## 63. First Experiment

The first experiment should be:

```text
arcon-exp-001
```

Goal:

```text
Behavioral proof-of-concept
```

Success means:

```text
Arcon identity improves
+
Conversation behavior improves
+
Emotion behavior improves
+
Curiosity improves
+
Self-reference improves
```

without major general capability degradation.

---

## 64. What Not To Do

Do not:

```text
Train on raw chat logs without filtering.
Train on private information unnecessarily.
Train on evaluation data.
Train for hundreds of epochs.
Use massive learning rates.
Replace the runtime memory system.
Remove emotion state because the model can "simulate emotion."
Assume model output equals internal state.
Treat the model as the entire Arcon architecture.
```

---

## 65. Privacy

Training data may eventually include real Arcon conversations.

Before using real conversations:

```text
Review
Sanitize
Remove unnecessary sensitive information
Separate training from private runtime data
```

Do not blindly train on the entire conversation history.

---

## 66. Real Conversation Dataset

Eventually, selected real conversations may be used to improve Arcon.

The process should be:

```text
Conversation
 ↓
Selection
 ↓
Cleaning
 ↓
Anonymization where necessary
 ↓
Behavior labeling
 ↓
Human review
 ↓
Dataset
```

---

## 67. Continuous Improvement

Arcon should eventually follow:

```text
Conversation
 ↓
Experience
 ↓
Evaluation
 ↓
Dataset improvement
 ↓
Training
 ↓
New model
 ↓
Evaluation
 ↓
Deployment
```

This creates an iterative development loop.

---

## 68. Never Automatically Train From Every Conversation

Runtime conversations should NOT automatically become training data.

Otherwise Arcon risks learning:

```text
mistakes
hallucinations
bad responses
temporary emotional states
incorrect facts
undesirable behavior
```

Training data must be curated.

---

## 69. Human Feedback

Future training may include feedback such as:

```text
Good response
Bad response
Too robotic
Too emotional
Incorrect memory
Good question
Bad question
Good emotional reaction
Unnatural reaction
```

This can later become preference-training data.

---

## 70. Future Training Methods

After the first QLoRA experiments, possible approaches include:

```text
SFT
DPO
Preference optimization
Reward modeling
Continued pretraining
Distillation
```

These should only be introduced when the simpler approach has been evaluated.

---

## 71. First Milestone

The first milestone is:

> **Arcon-0.1 can be recognized as Arcon rather than generic Qwen.**

It should:

```text
Know its identity
Maintain conversational context
Respond naturally
Express consistent personality
React appropriately to emotion
Develop contextual curiosity
Reflect on previous responses
Avoid obvious generic-assistant behavior
```

---

## 72. Second Milestone

The second milestone is:

> **Arcon-0.1 works correctly with the Arcon runtime.**

Architecture:

```text
User
 ↓
Arcon Runtime
 ↓
Memory
 ↓
Emotion
 ↓
Experience
 ↓
Conversation Context
 ↓
Arcon Model
 ↓
Response
 ↓
Runtime State Update
```

---

## 73. Third Milestone

The third milestone is:

> **Arcon can maintain a coherent relationship across sessions.**

This requires:

```text
Conversation logs
+
Long-term memory
+
Experience
+
Emotion
+
Relationship
+
Arcon model
```

---

## 74. Final Architecture Target

Eventually:

```text
                         ┌───────────────┐
                         │   User Input  │
                         └───────┬───────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │   Arcon Runtime     │
                      │                     │
                      │ Context             │
                      │ Memory              │
                      │ Emotion             │
                      │ Experience          │
                      │ Identity            │
                      │ Interests           │
                      │ Relationship        │
                      └──────────┬──────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │    Arcon-0.x        │
                      │       Model         │
                      │                     │
                      │ Reasoning           │
                      │ Personality         │
                      │ Reflection          │
                      │ Curiosity           │
                      │ Conversation        │
                      └──────────┬──────────┘
                                 │
                                 ▼
                             Response
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │ Runtime State       │
                      │ Update              │
                      └─────────────────────┘
```

---

## 75. Definition of Done

The first Arcon training cycle is complete when:

```text
[ ] Training environment created
[ ] CUDA verified
[ ] Qwen3-4B training checkpoint obtained
[ ] Dataset structure created
[ ] Initial dataset created
[ ] Dataset validated
[ ] Train/validation/evaluation split created
[ ] QLoRA configured
[ ] First experiment completed
[ ] Checkpoint saved
[ ] Evaluation completed
[ ] Regression testing completed
[ ] Human review completed
[ ] Best checkpoint selected
[ ] Model exported
[ ] Model loaded locally
[ ] Arcon runtime integration tested
[ ] Qwen3 baseline preserved
[ ] Experiment documented
```

---

## 76. Immediate Implementation Plan

The work should now move from specification to implementation.

Do NOT create additional architecture documents unless a genuinely new architectural problem appears.

The next practical sequence is:

```text
STEP 1
Create training/ directory.

        ↓

STEP 2
Create Python virtual environment.

        ↓

STEP 3
Verify NVIDIA/CUDA/PyTorch.

        ↓

STEP 4
Install compatible training dependencies.

        ↓

STEP 5
Verify Qwen3-4B training checkpoint.

        ↓

STEP 6
Create dataset tooling.

        ↓

STEP 7
Create first small Arcon dataset.

        ↓

STEP 8
Create validation/evaluation dataset.

        ↓

STEP 9
Run baseline Qwen3 evaluation.

        ↓

STEP 10
Configure QLoRA.

        ↓

STEP 11
Run arcon-exp-001.

        ↓

STEP 12
Evaluate checkpoint.

        ↓

STEP 13
Compare against Qwen3 baseline.

        ↓

STEP 14
Decide:
ACCEPT
or
REJECT

        ↓

STEP 15
Only after acceptance:
Integrate Arcon model with runtime.
```

---

## 77. First Command

The first implementation action is:

```powershell
cd C:\Projects\Arcon

mkdir training
```

Then create:

```text
training/
├── README.md
├── requirements.txt
├── configs/
├── datasets/
├── scripts/
├── outputs/
├── evaluations/
└── experiments/
```

Do not start training yet.

---

## 78. First Technical Goal

Before writing any training code, prove that the machine can successfully load:

```text
Qwen3-4B
```

through the Python training stack.

The first milestone is therefore:

```text
Python
 ↓
PyTorch
 ↓
CUDA
 ↓
Transformers
 ↓
Qwen3-4B
```

Only after this works should QLoRA configuration begin.

---

## 79. Final Principle

The first Arcon model does not need to be perfect.

It needs to prove that the idea works.

The development loop is:

```text
Build
 ↓
Measure
 ↓
Train
 ↓
Evaluate
 ↓
Observe failures
 ↓
Improve dataset
 ↓
Train again
```

Arcon should evolve through controlled experiments rather than uncontrolled model modifications.

---

## 80. End State

The ultimate objective is not:

```text
"Make Qwen answer like Arcon."
```

The objective is:

```text
"Create a model whose learned behavioral tendencies
form the cognitive foundation of Arcon."
```

The runtime provides:

```text
Memory
Experience
Emotion
Identity
Relationship
State
```

The model provides:

```text
Reasoning
Language
Interpretation
Reflection
Conversation
Personality expression
```

Together they form:

```text
                         ARCON

              ┌─────────────────────┐
              │ Persistent State     │
              │                     │
              │ Memory              │
              │ Emotion             │
              │ Experience          │
              │ Relationship        │
              │ Identity            │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │ Arcon Cognitive     │
              │ Model               │
              │                     │
              │ Reasoning           │
              │ Reflection          │
              │ Curiosity           │
              │ Personality         │
              │ Conversation        │
              └──────────┬──────────┘
                         │
                         ▼
                    Interaction
                         │
                         ▼
                 New Experience
                         │
                         └───────────────┐
                                         │
                                         ▼
                                  Persistent State
```
