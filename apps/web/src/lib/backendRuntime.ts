import { InMemoryBackendStore, createPrototypeAlignedFixtures } from "@repo/backend";

declare global {
  var __iapBackendStore: InMemoryBackendStore | undefined;
}

export function getBackendStore(): InMemoryBackendStore {
  if (!globalThis.__iapBackendStore) {
    globalThis.__iapBackendStore = new InMemoryBackendStore(createPrototypeAlignedFixtures());
  }

  return globalThis.__iapBackendStore;
}
