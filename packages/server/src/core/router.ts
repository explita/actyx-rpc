export function createRouter<T extends Record<string, any>>(procedures: T): T {
  if (typeof globalThis !== "undefined") {
    (globalThis as any).__ACTYX_RPC_ROUTER__ = procedures;
  }
  return procedures;
}

