import { describe, it, expect } from "vitest";
import { createProcedure } from "../src/core/server.js";
import { MemoryCache } from "../src/core/cache/memory-cache.js";

describe("ctx.cache", () => {
  it("supports get, set, and invalidation from inside a terminal handler", async () => {
    const cache = new MemoryCache();
    await cache.set("foo", { data: 1 });
    await cache.set("user:me", { x: 1 });

    const proc = createProcedure({
      createContext: () => ({ ok: true, ctx: { userId: "me" as string } }),
      cache,
      enrichInput(ctx) {
        return { userId: ctx.userId };
      },
    });

    const q = proc.query(async ({ ctx, input }) => {
      // Set custom cache entry
      await ctx.cache.set("custom:key", { val: 42 });

      // key-fn ctx/input are typed
      await ctx.cache.invalidate({
        keys: ({ ctx, input }) => `user:${ctx.userId}`,
      });
      await ctx.cache.invalidate({ tags: ["tagA"], delay: 0 });
      await ctx.cache.invalidate({ patterns: ["f*"] });
      return "ok" as const;
    });

    const [result, error] = await q();
    expect(error).toBeNull();
    expect(result).toBe("ok");
    expect(await cache.get("foo")).toBeUndefined();
    expect(await cache.get("user:me")).toBeUndefined();
    expect((await cache.get("custom:key"))?.data).toEqual({ val: 42 });
  });
});
