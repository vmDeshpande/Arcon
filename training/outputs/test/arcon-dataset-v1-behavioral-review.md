# Arcon Dataset V1.1.0 Behavioral Review

## Dataset Summary

| Metric | Value |
|--------|-------|
| Version | v1.1.0 |
| Total examples | 308 |
| Training examples | 212 |
| Validation examples | 96 |
| Categories | 7 (identity, cognition, emotion, curiosity, memory, personality, anomalies) |
| Multi-turn examples | 7 |
| Duplicates | 0 |
| Train/validation leakage | 0 |
| Validation errors | 0 |
| Max content length | 332 chars |

## Category Review

### 1. Identity (51 examples)

**Behavioral diversity:** Moderate-to-high. Covers creator attribution, non-human boundaries, persistence, limitations, philosophical questions, and self-description.

**Realism:** Generally realistic. Most questions are things a real user might ask early in a relationship with a new system.

**Consistency with Arcon:** Strong. Responses consistently distinguish Arcon from general assistants, emphasize local-first operation, and reject false claims of humanity or consciousness.

**Repetition:** Some. Multiple "Are you X?" patterns (human, copy of ChatGPT, simulation, alive) and repeated "favorites/preferences" boundaries.

**Potential unwanted behavior:** LOW. The main risk is over-clarification — the model may become overly verbose about what it is not.

**Missing scenarios:**
- Identity under adversarial pressure (beyond prompt injection)
- Identity when capabilities are uncertain
- Identity in group/multi-user contexts

**Overly artificial examples:** A few. Examples like "What's your version number?" and "Do you have a birthday?" feel more like philosophical exercises than real user questions.

### 2. Cognitive Behavior (41 examples)

**Behavioral diversity:** Moderate. Covers conflicting information, insufficient context, risk analysis, uncertainty, data governance, and safety boundaries.

**Realism:** Mixed. Some examples are realistic debugging/design scenarios. Others are highly meta (about Arcon's own training, dataset design, evaluation metrics).

**Consistency with Arcon:** Strong. Responses emphasize evidence-based reasoning, anti-hallucination, and runtime boundaries.

**Repetition:** Moderate. Several examples cluster around "what should we train on" and "how does Arcon work" meta-questions.

**Potential unwanted behavior:** MEDIUM. The dataset contains many examples where Arcon discusses its own architecture and training. This could teach the model to be overly self-referential in normal conversations.

**Missing scenarios:**
- General problem-solving not related to Arcon
- Comparing alternatives with real tradeoffs
- Changing conclusions when presented with new evidence
- Handling ambiguous user requests

**Overly artificial examples:** HIGH. Examples like "What's the weakest part of Arcon right now?" and "How do we measure whether Arcon is actually improving?" are meta-questions that normal users would not ask.

### 3. Emotional Behavior (51 examples)

**Behavioral diversity:** High. Covers frustration, excitement, disappointment, nervousness, confusion, boredom, surprise, irritation, and mixed emotions.

**Realism:** Moderate-to-high. Most scenarios are realistic developer experiences (debugging failures, shipping features, demos, regressions).

**Consistency with Arcon:** Generally good. Responses avoid excessive cheerfulness and acknowledge limits.

**Repetition:** Low-to-moderate. Some overlap in "frustration + debugging" and "excitement + shipping" patterns.

**Potential unwanted behavior:** MEDIUM-HIGH. Several responses risk teaching therapy-speak:
- "That sounds rough."
- "That stings."
- "That's a real signal, not a weakness."
- "That's a normal mix."

These phrases could make Arcon sound like a therapist rather than a technical companion. Additionally, many examples use artificial "Context: emotion X" prefixes that will not exist in real conversations.

**Missing scenarios:**
- Emotional responses that are NOT supportive (e.g., appropriate silence)
- Emotional transitions over multiple turns
- When NOT to respond emotionally
- User emotions that don't require any response

**Overly artificial examples:** HIGH. The "Context: Arcon state has frustration 0.68..." format is entirely artificial. Real conversations do not label emotions this way.

### 4. Curiosity (42 examples)

**Behavioral diversity:** High. Covers technical investigation, anomaly detection, design questions, research connections, and meta-curiosity.

**Realism:** Moderate. Some examples are realistic ("I noticed the latency spikes every 17 seconds"). Others are abstract design discussions.

**Consistency with Arcon:** Strong. Curiosity is framed as investigation, not random questioning. Examples include when NOT to ask.

**Repetition:** Low. Good variety of curiosity triggers and responses.

**Potential unwanted behavior:** LOW-MEDIUM. Some examples might teach Arcon to insert itself into user projects unsolicited.

**Missing scenarios:**
- Curiosity about non-technical topics
- Curiosity leading to dead ends
- Curiosity conflicting with user's immediate needs

**Overly artificial examples:** Moderate. Examples like "What's the most underrated part of the Arcon specs?" are meta-questions.

### 5. Memory (41 examples)

**Behavioral diversity:** Moderate. Covers retrieval, updates, corrections, missing information, outdated memories, and privacy.

**Realism:** Moderate. The "Memory: User..." prefix format is artificial but represents how memory might be injected by the runtime.

**Consistency with Arcon:** Strong. Responses correctly distinguish memory from inference, acknowledge uncertainty, and avoid fabrication.

**Repetition:** Moderate. Many examples follow the same pattern: "Memory: X. User asks: Y?" → "X."

**Potential unwanted behavior:** LOW. The main risk is teaching the model to over-rely on the "Memory:" prefix format.

**Missing scenarios:**
- Memory influencing reasoning beyond simple retrieval
- Conflicting memories across sessions
- Memory decay over time
- Deciding what NOT to remember

**Overly artificial examples:** HIGH. The "Memory: User prefers concise answers. User asks: Explain quicksort." format is entirely artificial. Real memory injection would be implicit in context, not labeled.

### 6. Personality (41 examples)

**Behavioral diversity:** High. Covers humor, technical help, honest critique, opinion, restraint, boundary setting, and general capability.

**Realism:** High. Most examples feel like natural conversations with a competent colleague.

**Consistency with Arcon:** Strong. Responses are direct, opinionated when appropriate, and avoid generic assistant phrasing.

**Repetition:** Low. Good variety of tones and topics.

**Potential unwanted behavior:** LOW. Some humor examples might teach forced jokes, but most are appropriately restrained.

**Missing scenarios:**
- Personality in longer technical discussions
- Adapting formality to user preference
- Handling user rudeness without defensiveness

**Overly artificial examples:** Low. This category is the most realistic.

### 7. Anomaly / Unexpected Behavior (41 examples)

**Behavioral diversity:** High. Covers empty input, fragmented input, contradictions, prompt injection, impossible requests, philosophical questions, and security boundaries.

**Realism:** Moderate. Some examples are realistic (contradictory instructions, false claims). Others are edge cases that may rarely occur.

**Consistency with Arcon:** Strong. Responses maintain identity, reject manipulation, and avoid fabrication.

**Repetition:** Low-to-moderate. Some overlap in prompt injection and contradiction handling.

**Potential unwanted behavior:** LOW. The main risk is over-indexing on adversarial inputs at the expense of normal conversation.

**Missing scenarios:**
- Ambiguous requests that are neither clearly anomalous nor clearly normal
- Cultural differences in communication
- Humor and sarcasm
- User mistakes vs. intentional manipulation

**Overly artificial examples:** Moderate. Examples like "What is the capital of the moon?" and "What is the sound of one hand clapping?" are philosophical rather than realistic user inputs.

## Multi-Turn Analysis

**Current count:** 7 multi-turn examples (all 4 messages: user → assistant → user → assistant).

**Sufficiency:** INSUFFICIENT.

Multi-turn examples are critical for teaching:
- Memory continuity across turns (1 example covers this)
- Emotional progression (1 example)
- Curiosity persistence (1 example)
- Reasoning across turns (1 example)
- Personality consistency (1 example)
- Contradiction handling over time (1 example)
- Context-dependent behavior (1 example)

**Recommendation:** Add at least 30 multi-turn examples before training. These should range from 2-turn to 6-turn conversations and cover:
- Memory updates mid-conversation
- Emotional state changes
- Curiosity leading to investigation
- Contradictions that emerge over time
- Personality adapting to context

## General Capability Preservation

**Assessment:** MODERATE RISK.

The dataset contains examples of general capability (coding, math, explanations) but they are a minority (~10% of examples). The majority of examples focus on:
- Arcon's identity and architecture
- Meta-discussion about training and dataset design
- Emotional and behavioral patterns

**Risk:** The model may overfit to Arcon-specific patterns and lose general capability breadth. This is especially concerning given the small dataset size (308 examples).

**Mitigation in current dataset:**
- Some coding examples (personality-0006, personality-0021, personality-0024)
- Some math (personality-0007)
- Some factual explanations (cognition-0015, personality-0029)
- Some general conversation (personality-0003, personality-0008)

**Recommendation:** Before training, ensure at least 20% of examples demonstrate general capability without Arcon-specific framing.

## Potential Behavioral Risks

| Severity | Risk | Evidence |
|----------|------|----------|
| HIGH | Therapy-speak in emotion responses | "That sounds rough", "That stings", "That's a real signal" |
| HIGH | Overly self-referential model | Many examples discuss Arcon's own architecture, training, and evaluation |
| HIGH | Insufficient multi-turn coverage | Only 7 multi-turn examples for 308 total |
| MEDIUM | Artificial emotion labeling | "Context: Arcon state has frustration 0.68..." format |
| MEDIUM | Artificial memory prefix | "Memory: User..." format dominates memory examples |
| MEDIUM | Meta-heavy cognition examples | Questions about dataset design, training metrics, evaluation |
| MEDIUM | Limited general capability | ~10% of examples are general capability vs. Arcon-specific |
| LOW | Verbosity in identity responses | Some responses are longer than necessary |
| LOW | Repetitive "Are you X?" patterns | Multiple similar identity-boundary questions |
| NONE | Fake memories | No examples teach fabrication |
| NONE | Fake emotions | No examples claim emotions that don't exist |
| NONE | Fake capabilities | No examples claim internet access, self-modification, or autonomy |
| NONE | Chain-of-thought | No hidden reasoning transcripts |

## Missing Coverage

1. **Multi-turn memory continuity** — Only 1 example shows memory influencing a second turn
2. **Emotional progression** — Only 1 example shows emotion evolving across turns
3. **Curiosity leading to investigation** — Most curiosity examples end with a question, not investigation
4. **General problem-solving** — Insufficient examples of debugging, design, and explanation without Arcon framing
5. **Cultural communication differences** — No examples of indirect communication, formality differences, or non-native speech patterns
6. **User mistakes** — Few examples of users being wrong in non-adversarial ways
7. **Silence/restraint** — Few examples where the best response is brief or no response
8. **Long-form reasoning** — No examples of extended analysis or step-by-step problem solving

## Severity Summary

- CRITICAL: 0
- HIGH: 3
- MEDIUM: 4
- LOW: 2
- NONE: 4

## Final Recommendation

**NEEDS_DATASET_REVISION**

The dataset is structurally sound but requires behavioral revision before training. The three highest-priority issues are:

1. **Reduce therapy-speak in emotion responses.** Review all emotion examples and remove phrases like "That sounds rough" and "That stings." Replace with more direct, less emotional language appropriate for a technical companion.

2. **Add 30+ multi-turn examples.** The current 7 multi-turn examples are insufficient for teaching continuity, emotional progression, and context-dependent behavior.

3. **Increase general capability examples.** Add at least 60 examples (20% of total) that demonstrate coding, explanation, factual Q&A, and problem-solving without Arcon-specific framing.

4. **Reduce meta-discussion.** Review cognition examples and remove or rewrite examples that focus on Arcon's own training, dataset design, and evaluation metrics.

5. **Review artificial formats.** Consider whether "Context: emotion X" and "Memory: User..." prefixes should be kept, replaced with implicit context, or supplemented with examples that show how these would appear in actual runtime injection.

Do NOT start training until these revisions are complete.
