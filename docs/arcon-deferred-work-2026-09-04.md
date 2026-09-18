# Deferred Work and Next-Phase Integration Plan

## Deferred Work

Ideas that are important future features but not required for this phase:

- Advanced reflection / autonomous background activity
- Deeper self-modeling (emotional trajectory analysis, long-term pattern detection)
- Browser automation / web access
- Voice improvements (full STT/TTS integration into chat runtime)
- Screen awareness / computer control
- External integrations (Slack, email, calendar)
- Complex planning / multi-step task execution
- Proactive behavior (autonomous check-ins, reminders)
- Database connection pool management (ChatService instances Map has no eviction)
- ConversationContext persistence (lost on server restart)

## Next-Phase Integration Plan: Ling 3

### Prerequisites
- Hardware: minimum 96GB GPU (RTX PRO 6000 Blackwell) or multi-GPU setup
- Software: `inclusionAI/vllm` fork (ling_3_0 branch) or patched llama.cpp (bailing_hybrid)

### Integration Steps
1. Deploy Ling 3 via vLLM with inclusionAI/vllm fork, OpenAI-compatible endpoint on port 8000
2. Verify streaming support via `/v1/chat/completions` with `stream: true`
3. Update server config: `ARCON_INFERENCE_BACKEND=arcon-lora` → keep existing, or add `ARCON_INFERENCE_BACKEND=ling3` option
4. Create `Ling3Provider` implementing `ModelProvider` interface (`packages/ai/src/model-provider.ts`)
5. Register provider in `ModelProviderRegistry` for runtime model switching
6. Update `RuntimeIdentity` fields for Ling 3 (baseModel: "inclusionAI/Ling-3.0-flash", quantization: "FP4", etc.)
7. Run A/B evaluation: Ling 3 vs Qwen3-4B/V1 on Arcon evaluation benchmarks
8. Compare: startup, latency, memory correctness, identity grounding, multi-turn coherence

### Model Provider Abstraction (ready for Ling 3)
- Interface: `packages/ai/src/model-provider.ts` — `ModelProvider` with `generateReply`, `generateReplyStream`, `getModelInfo`, `getRuntimeIdentity`, `healthCheck`, `getDiagnostics`
- Current provider: `ArconLoRAProvider` (`packages/ai/src/inference/arcon-lora-provider.ts`) — compatible via structural typing
- Export: `packages/ai/src/index.ts` — `ModelProvider` type exported
- Registry: not yet implemented — can be added when switching between models is needed at runtime

### Preserved Paths
- Qwen3-4B + arcon-v1: ACTIVE runtime path (unchanged)
- Qwen3-4B base model: available fallback (unchanged)
- V1/V2 training artifacts: locked (unchanged)
- V3 training: NOT started (unchanged)
