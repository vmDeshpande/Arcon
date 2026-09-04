import type { RuntimeIdentity } from "./runtime-identity.js";
import type { RuntimeCapabilities, RuntimeCapability, CapabilityStatus } from "./runtime-capabilities.js";

export interface RuntimeStateOptions {
  identity: RuntimeIdentity;
  hasPersistentMemory: boolean;
  hasConversationPersistence: boolean;
  hasVoice: boolean;
  hasWebAccess: boolean;
  hasComputerControl: boolean;
  hasBackgroundProcessing: boolean;
  hasVectorSearch: boolean;
  hasToolCalling: boolean;
  hasStreaming: boolean;
}

export interface RuntimeState {
  version: string;
  generatedAt: string;
  identity: RuntimeIdentity;
  capabilities: RuntimeCapabilities;
  status: "ready" | "degraded" | "error";
}

export function buildRuntimeCapabilities(options: RuntimeStateOptions): RuntimeCapabilities {
  const caps: RuntimeCapability[] = [
    {
      name: "persistent personal memory",
      status: options.hasPersistentMemory ? "IMPLEMENTED" : "UNAVAILABLE",
      notes: options.hasPersistentMemory
        ? "SQLite-backed with lifecycle states (ACTIVE, ARCHIVED, OBSOLETE, etc.)"
        : "No persistent memory store available",
    },
    {
      name: "conversation history",
      status: options.hasConversationPersistence ? "IMPLEMENTED" : "PARTIAL",
      notes: options.hasConversationPersistence
        ? "SQLite-backed full history with reconstruction"
        : "In-memory only; lost on restart",
    },
    {
      name: "personality",
      status: "IMPLEMENTED",
      notes: "Identity, relationship, mood, emotion, interest engines",
    },
    {
      name: "emotion state",
      status: "IMPLEMENTED",
      notes: "5 emotions (curiosity, trust, happiness, confidence, frustration) with decay",
    },
    {
      name: "curiosity",
      status: "IMPLEMENTED",
      notes: "Interest engine with Arcon self-interests",
    },
    {
      name: "reflection",
      status: "PARTIAL",
      notes: "Experience tracking; no autonomous reflection loop",
    },
    {
      name: "web access",
      status: options.hasWebAccess ? "IMPLEMENTED" : "NOT_IMPLEMENTED",
      notes: options.hasWebAccess ? "Web search available" : "No external web access",
    },
    {
      name: "screen awareness",
      status: "NOT_IMPLEMENTED",
      notes: "No computer interaction",
    },
    {
      name: "computer control",
      status: options.hasComputerControl ? "PARTIAL" : "NOT_IMPLEMENTED",
      notes: options.hasComputerControl ? "Basic file operations" : "No autonomous workflows",
    },
    {
      name: "background processing",
      status: options.hasBackgroundProcessing ? "PARTIAL" : "NOT_IMPLEMENTED",
      notes: options.hasBackgroundProcessing
        ? "Deferred memory extraction"
        : "No scheduled tasks",
    },
    {
      name: "semantic/vector search",
      status: options.hasVectorSearch ? "PARTIAL" : "NOT_IMPLEMENTED",
      notes: options.hasVectorSearch ? "Hybrid search available" : "Keyword + entity matching only",
    },
    {
      name: "trained Arcon adapter",
      status: options.identity.adapterActive ? "IMPLEMENTED" : "PARTIAL",
      notes: options.identity.adapterActive
        ? `${options.identity.adapterName} (${options.identity.adapterVersion}) active on ${options.identity.inferenceBackend}`
        : "No adapter loaded; running base model only",
    },
    {
      name: "voice capabilities",
      status: options.hasVoice ? "PARTIAL" : "PARTIAL",
      notes: options.hasVoice
        ? "STT/TTS interfaces integrated"
        : "STT/TTS interfaces exist; not fully integrated into chat runtime",
    },
    {
      name: "tool calling",
      status: options.hasToolCalling ? "IMPLEMENTED" : "NOT_IMPLEMENTED",
      notes: options.hasToolCalling ? "Tool execution available" : "No tool-calling infrastructure",
    },
    {
      name: "streaming responses",
      status: options.hasStreaming ? "IMPLEMENTED" : "NOT_IMPLEMENTED",
      notes: options.hasStreaming
        ? "SSE streaming supported"
        : "Streaming not configured",
    },
  ];

  return {
    version: "0.2.0",
    generatedAt: new Date().toISOString(),
    capabilities: caps,
  };
}

export function getCapabilityStatus(capabilities: RuntimeCapabilities, name: string): CapabilityStatus {
  const cap = capabilities.capabilities.find((c) => c.name === name);
  return cap?.status ?? "NOT_IMPLEMENTED";
}

export function isCapabilityAvailable(capabilities: RuntimeCapabilities, name: string): boolean {
  return getCapabilityStatus(capabilities, name) === "IMPLEMENTED";
}

export function buildRuntimeState(options: RuntimeStateOptions): RuntimeState {
  const identity = options.identity;
  const capabilities = buildRuntimeCapabilities(options);

  let status: RuntimeState["status"] = "ready";

  if (!identity.adapterActive && identity.inferenceBackend === "arcon-lora") {
    status = "degraded";
  }

  if (identity.adapterActive && identity.baseModel === "unknown") {
    status = "degraded";
  }

  return {
    version: "0.2.0",
    generatedAt: new Date().toISOString(),
    identity,
    capabilities,
    status,
  };
}

const DEFAULT_RUNTIME_STATE_OPTIONS: RuntimeStateOptions = {
  identity: {
    baseModel: "Qwen/Qwen3-4B",
    adapterName: "arcon-v1",
    adapterVersion: "rank-8",
    adapterPath: "unknown",
    inferenceBackend: "arcon-lora",
    adapterActive: false,
    loadedAt: "",
    gpuMemoryAllocatedMB: 0,
    gpuMemoryReservedMB: 0,
  },
  hasPersistentMemory: true,
  hasConversationPersistence: true,
  hasVoice: false,
  hasWebAccess: false,
  hasComputerControl: false,
  hasBackgroundProcessing: false,
  hasVectorSearch: false,
  hasToolCalling: false,
  hasStreaming: false,
};

export function createDefaultRuntimeState(): RuntimeState {
  return buildRuntimeState(DEFAULT_RUNTIME_STATE_OPTIONS);
}
