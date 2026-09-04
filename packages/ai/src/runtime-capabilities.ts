export type CapabilityStatus = "IMPLEMENTED" | "PARTIAL" | "NOT_IMPLEMENTED" | "UNAVAILABLE";

export interface RuntimeCapability {
  name: string;
  status: CapabilityStatus;
  notes: string;
}

export interface RuntimeCapabilities {
  version: string;
  generatedAt: string;
  capabilities: RuntimeCapability[];
}

export const DEFAULT_CAPABILITIES: RuntimeCapabilities = {
  version: "0.1.0",
  generatedAt: new Date().toISOString(),
  capabilities: [
    { name: "persistent personal memory", status: "IMPLEMENTED", notes: "SQLite-backed with lifecycle states" },
    { name: "conversation history", status: "IMPLEMENTED", notes: "SQLite-backed full history" },
    { name: "personality", status: "IMPLEMENTED", notes: "Identity, relationship, mood, emotion, interest" },
    { name: "emotion state", status: "IMPLEMENTED", notes: "5 emotions with decay" },
    { name: "curiosity", status: "IMPLEMENTED", notes: "Interest engine with Arcon self-interests" },
    { name: "reflection", status: "PARTIAL", notes: "Experience tracking; no autonomous reflection loop" },
    { name: "web access", status: "NOT_IMPLEMENTED", notes: "No external tool execution" },
    { name: "screen awareness", status: "NOT_IMPLEMENTED", notes: "No computer interaction" },
    { name: "computer control", status: "NOT_IMPLEMENTED", notes: "No autonomous workflows" },
    { name: "background processing", status: "NOT_IMPLEMENTED", notes: "No scheduled tasks" },
    { name: "semantic/vector search", status: "NOT_IMPLEMENTED", notes: "Keyword + entity matching only" },
    { name: "trained Arcon adapter", status: "PARTIAL", notes: "Python inference service supports loading; Node.js runtime integrates via arcon-lora backend" },
    { name: "voice capabilities", status: "PARTIAL", notes: "STT/TTS interfaces exist; not fully integrated into chat runtime" },
  ],
};
