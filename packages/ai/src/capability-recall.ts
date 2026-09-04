import type { RuntimeState } from "./runtime-state.js";
import type { RuntimeIdentity } from "./runtime-identity.js";
import type { RuntimeCapabilities } from "./runtime-capabilities.js";
import { ARCON_IDENTITY } from "@arcon/personality";

export interface CapabilityRecallResult {
  reply: string | null;
  confidence: number;
  category: string;
}

export type CapabilityQuery =
  | "model"
  | "base_model"
  | "adapter"
  | "backend"
  | "adapter_active"
  | "memory"
  | "conversation_persistence"
  | "voice"
  | "web_access"
  | "computer_control"
  | "background"
  | "tools"
  | "streaming"
  | "self_identity"
  | "creator"
  | "unknown";

const MODEL_QUERY_PATTERNS: { pattern: RegExp; query: CapabilityQuery }[] = [
  { pattern: /\b(what model|which model|your model|base model|underlying model|model are you running|what.*running.*model|qwen3)\b/i, query: "model" },
  { pattern: /\b(what adapter|which adapter|your adapter|lora adapter|trained adapter|adapter active|adapter loaded|adapter you use|running.*adapter|adapter.*running|use.*lora|using.*lora)\b/i, query: "adapter" },
  { pattern: /\b(what.*backend|which.*backend|inference backend|backend.*use|what.*service)\b/i, query: "backend" },
  { pattern: /\b(adapter active|adapter loaded|using.*adapter|adapter.*active|is.*adapter.*running)\b/i, query: "adapter_active" },
  { pattern: /\b(conversation.*persist|conversations.*survive|chat.*history.*persist|conversation.*survive)\b/i, query: "conversation_persistence" },
  { pattern: /\b(memory|persist|survive.*restart|stored.*sqlite|database|remember.*across|remember.*thing|long.term.*memory)\b/i, query: "memory" },
  { pattern: /\b(voice|speech|tts|stt|audio)\b/i, query: "voice" },
  { pattern: /\b(web.*search|browse.*web|web access|browse.*internet|internet access)\b/i, query: "web_access" },
  { pattern: /\b(computer.*control|screen.*aware|desktop.*interaction|filesystem|file system|file access)\b/i, query: "computer_control" },
  { pattern: /\b(background|background.*process|scheduled|run.*background|background.*task)\b/i, query: "background" },
  { pattern: /\b(tool.*call|function.*call|use.*tools?|tool.*avail|tool.*execut|tools|no.*tool)\b/i, query: "tools" },
  { pattern: /\b(stream|streaming|real.time|token.*stream)\b/i, query: "streaming" },
  { pattern: /\b(who are you|what are you|what is arcon|what kind of ai|who is arcon|tell me about arcon|what kind of companion)\b/i, query: "self_identity" },
  { pattern: /\b(who created you|whose creation|who made you|creator|your creator)\b/i, query: "creator" },
];

export class CapabilityRecall {
  constructor(private readonly runtimeState: RuntimeState) {}

  classify(message: string): CapabilityQuery {
    const lower = message.toLowerCase().trim();

    for (const { pattern, query } of MODEL_QUERY_PATTERNS) {
      if (pattern.test(lower)) {
        return query;
      }
    }

    return "unknown";
  }

  handle(query: CapabilityQuery): CapabilityRecallResult {
    const { identity, capabilities } = this.runtimeState;

    switch (query) {
      case "model":
        return {
          reply: `I run on ${identity.baseModel} with the ${identity.adapterName} adapter. Arcon is the full companion system; the base model is the underlying language engine and the adapter provides my behavioral tuning.`,
          confidence: 0.95,
          category: "model",
        };

      case "base_model":
        return {
          reply: `My underlying base model is ${identity.baseModel}. The Arcon adapter (${identity.adapterName}) is applied on top to give me my behavioral characteristics.`,
          confidence: 0.98,
          category: "model",
        };

      case "adapter":
        if (identity.adapterActive) {
          return {
            reply: `I am running the ${identity.adapterName} adapter (version: ${identity.adapterVersion}) loaded from ${identity.adapterPath}.`,
            confidence: 0.98,
            category: "adapter",
          };
        }
        return {
          reply: `No adapter is currently active. I am running the raw ${identity.baseModel} base model without behavioral tuning.`,
          confidence: 0.95,
          category: "adapter",
        };

      case "adapter_active":
        return {
          reply: identity.adapterActive
            ? `Yes, the ${identity.adapterName} adapter is active and loaded.`
            : "No adapter is currently active.",
          confidence: 0.98,
          category: "adapter",
        };

      case "backend":
        return {
          reply: `My inference backend is ${identity.inferenceBackend}`.concat(
            identity.gpuMemoryAllocatedMB > 0
              ? `, running on NVIDIA GPU (allocated: ${Math.round(identity.gpuMemoryAllocatedMB)} MB, reserved: ${Math.round(identity.gpuMemoryReservedMB)} MB).`
              : ".",
          ),
          confidence: 0.9,
          category: "backend",
        };

      case "memory": {
        const memStatus = capabilities.capabilities.find((c) => c.name === "persistent personal memory")?.status ?? "UNKNOWN";
        return {
          reply: memStatus === "IMPLEMENTED"
            ? "Yes, I have persistent memory. I store memories in a SQLite database that survives restarts."
            : "I do not have persistent memory.",
          confidence: 0.95,
          category: "memory",
        };
      }

      case "conversation_persistence": {
        const convStatus = capabilities.capabilities.find((c) => c.name === "conversation history")?.status ?? "UNKNOWN";
        return {
          reply: convStatus === "IMPLEMENTED"
            ? "Yes, our conversation history is persisted in SQLite and reconstructed when the server restarts."
            : "Conversation history is not persisted across restarts.",
          confidence: 0.9,
          category: "conversation_persistence",
        };
      }

      case "voice":
        return {
          reply: `Voice support is ${capabilityStatusLabel(capabilities, "voice capabilities")}.`,
          confidence: 0.9,
          category: "voice",
        };

      case "web_access":
        return {
          reply: `Web access is ${capabilityStatusLabel(capabilities, "web access")}.`,
          confidence: 0.9,
          category: "web",
        };

      case "computer_control":
        return {
          reply: `Computer control is ${capabilityStatusLabel(capabilities, "computer control")}.`,
          confidence: 0.9,
          category: "control",
        };

      case "background":
        return {
          reply: `Background processing is ${capabilityStatusLabel(capabilities, "background processing")}.`,
          confidence: 0.9,
          category: "background",
        };

      case "tools":
        return {
          reply: `Tool calling is ${capabilityStatusLabel(capabilities, "tool calling")}.`,
          confidence: 0.9,
          category: "tools",
        };

      case "streaming":
        return {
          reply: `Streaming is ${capabilityStatusLabel(capabilities, "streaming responses")}. I support token-by-token streaming for real-time responses.`,
          confidence: 0.9,
          category: "streaming",
        };

      case "self_identity":
        return {
          reply: `I am ${ARCON_IDENTITY.name}, ${ARCON_IDENTITY.purpose} I was created by ${ARCON_IDENTITY.creator}. My underlying base model is ${identity.baseModel} with the ${identity.adapterName} adapter.`,
          confidence: 0.98,
          category: "self_identity",
        };

      case "creator":
        return {
          reply: `I was created by ${ARCON_IDENTITY.creator}.`,
          confidence: 0.99,
          category: "creator",
        };

      default:
        return {
          reply: null,
          confidence: 0,
          category: "unknown",
        };
    }
  }

  handleMessage(message: string): CapabilityRecallResult {
    const query = this.classify(message);
    return this.handle(query);
  }
}

function capabilityStatusLabel(capabilities: RuntimeCapabilities, name: string): string {
  const cap = capabilities.capabilities.find((c) => c.name === name);
  if (!cap) return "not available";
  switch (cap.status) {
    case "IMPLEMENTED":
      return "available";
    case "PARTIAL":
      return "partially available";
    case "NOT_IMPLEMENTED":
      return "not available";
    default:
      return "unknown";
  }
}

export function createCapabilityRecall(runtimeState: RuntimeState): CapabilityRecall {
  return new CapabilityRecall(runtimeState);
}
