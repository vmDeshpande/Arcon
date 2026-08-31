export type RuntimeMode = "ollama" | "arcon-lora" | "base-model";

export interface RuntimeIdentity {
  baseModel: string;
  adapterName: string;
  adapterVersion: string;
  adapterPath: string;
  inferenceBackend: RuntimeMode;
  adapterActive: boolean;
  loadedAt: string;
  gpuMemoryAllocatedMB: number;
  gpuMemoryReservedMB: number;
}

export const DEFAULT_RUNTIME_IDENTITY: RuntimeIdentity = {
  baseModel: "unknown",
  adapterName: "none",
  adapterVersion: "unknown",
  adapterPath: "none",
  inferenceBackend: "ollama",
  adapterActive: false,
  loadedAt: "",
  gpuMemoryAllocatedMB: 0,
  gpuMemoryReservedMB: 0,
};
