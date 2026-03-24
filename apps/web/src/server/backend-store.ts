import { InMemoryBackendStore, createPrototypeAlignedFixtures } from "@repo/backend";

type GlobalWithBackendStore = typeof globalThis & {
  __iaprevBackendStore?: InMemoryBackendStore;
};

export function getBackendStore(): InMemoryBackendStore {
  const globalScope = globalThis as GlobalWithBackendStore;
  if (!globalScope.__iaprevBackendStore) {
    globalScope.__iaprevBackendStore = new InMemoryBackendStore(createPrototypeAlignedFixtures());
  }

  return globalScope.__iaprevBackendStore;
}
