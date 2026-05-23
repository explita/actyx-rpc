import { createProcedure, MemoryCache } from "@/dist";

export const procedure = createProcedure({
  createContext: () => ({
    ok: true,
    ctx: {
      ctxKey: "ctxValue",
    },
  }),
  enrichInput(ctx) {
    return {
      key1: "value1",
      key2: "value2",
      ...ctx,
    };
  },
  cache: new MemoryCache({ maxSize: 100, defaultTTL: 60000 }),
});
