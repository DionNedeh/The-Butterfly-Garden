/**
 * Node's own Blob, for tests that store a photo: fake-indexeddb copies what
 * it stores with Node's structuredClone, which copies Node's Blob, as every
 * browser's IndexedDB copies its own, but not jsdom's. The app's types do
 * not describe Node, so this names just the one export they use.
 */
declare module 'node:buffer' {
  export const Blob: typeof globalThis.Blob
}
