import { TracerootClient } from "./client";
import type { InitializeOptions } from "./types";

let globalClient: TracerootClient | null = null;

export function initializeGlobalClient(options: InitializeOptions = {}): TracerootClient {
  if (globalClient) {
    return globalClient;
  }

  globalClient = new TracerootClient(options);
  return globalClient;
}

export function getGlobalClient(): TracerootClient {
  if (!globalClient) {
    globalClient = new TracerootClient();
  }

  return globalClient;
}

export async function shutdownGlobalClient(): Promise<void> {
  if (!globalClient) {
    return;
  }

  await globalClient.shutdown();
  globalClient = null;
}
