import { describe, it, expect, vi } from "vitest";
import { createProcedure } from "../../packages/server/src/core/server.js";

describe("Infrastructure: Caching", () => {
  const procedure = createProcedure({
    inputMode: "form",
    createContext: () => ({ ok: true, ctx: { userId: "u1" } }),
  });

  it("should serve results from cache on repeated calls", async () => {
    let callCount = 0;
    const proc = procedure
      .name("cached-query")
      .cache({ key: () => "cached-query", ttl: 1000 })
      .query(async () => {
        callCount++;
        return "data";
      });

    await proc();
    await proc();
    const [result] = await proc();

    expect(callCount).toBe(1); // Only first call reached handler
    expect(result).toBe("data");
  });

  it("should invalidate cache correctly using tags", async () => {
    let value = 1;
    const getVal = procedure
      .name("get-with-tag")
      .cache({ key: () => "get-with-tag", tags: ["data-tag"], ttl: 10000 })
      .query(async () => value);

    const increment = procedure
      .invalidate({ tags: ["data-tag"] })
      .mutation(async () => {
        value++;
        return "ok";
      });

    await getVal(); // value is 1 (cached)
    await increment(); // value becomes 2, tag is invalidated
    const [result] = await getVal(); // Should reach handler and get 2

    expect(result).toBe(2);
  });

  it("should return raw data T from cache.remember without wrapper envelope", async () => {
    let callCount = 0;
    const proc = procedure.query(async ({ ctx }) => {
      const user = await ctx.cache.remember("remember-test-user", async () => {
        callCount++;
        return { id: "u-123", name: "Alice" };
      });
      return user;
    });

    const [first] = await proc();
    const [second] = await proc();

    expect(callCount).toBe(1);
    expect(first).toEqual({ id: "u-123", name: "Alice" });
    expect(second).toEqual({ id: "u-123", name: "Alice" });
    expect((first as any)?.metadata).toBeUndefined();
    expect((first as any)?.data).toBeUndefined();
  });

  it("should invalidate remember cache when tagged", async () => {
    let count = 0;
    const fetchCount = procedure.query(async ({ ctx }) => {
      return ctx.cache.remember(
        "tagged-remember",
        async () => ++count,
        { tags: ["tag:remember"] },
      );
    });

    const invalidateTag = procedure
      .invalidate({ tags: ["tag:remember"] })
      .mutation(async () => "invalidated");

    const [first] = await fetchCount();
    expect(first).toBe(1);

    const [second] = await fetchCount();
    expect(second).toBe(1);

    await invalidateTag();

    const [third] = await fetchCount();
    expect(third).toBe(2);
  });

  it("should pass (opts, ...args) to key and tags functions", async () => {
    let callCount = 0;
    const getItem = procedure
      .cache({
        ttl: 10000,
        key: ({ ctx }, itemId: string, variant: string) =>
          `item:${ctx.userId}:${itemId}:${variant}`,
        tags: (_opts, itemId: string) => [`item:${itemId}`],
      })
      .query(async (_opts, itemId: string, variant: string) => {
        callCount++;
        return `${itemId}-${variant}-${callCount}`;
      });

    const invalidateItem = procedure
      .invalidate({ tags: ["item:42"] })
      .mutation(async () => "ok");

    const [a1] = await getItem("42", "light");
    const [a2] = await getItem("42", "light");
    const [b1] = await getItem("42", "dark");

    expect(a1).toBe("42-light-1");
    expect(a2).toBe("42-light-1"); // Cache hit for ("42", "light")
    expect(b1).toBe("42-dark-2"); // Distinct key for ("42", "dark")

    await invalidateItem();
    const [a3] = await getItem("42", "light");
    expect(a3).toBe("42-light-3");
  });

  it("should support dynamic cache options factory and cache bypass on null/undefined", async () => {
    let callCount = 0;
    const proc = procedure
      .cache(({ ctx }, id: string, skipCache?: boolean) => {
        if (skipCache) return null;
        return {
          ttl: 10000,
          key: () => `dyn:${ctx.userId}:${id}`,
        };
      })
      .query(async (_opts, id: string, _skipCache?: boolean) => {
        callCount++;
        return `${id}:${callCount}`;
      });

    const [r1] = await proc("abc");
    const [r2] = await proc("abc");
    expect(r1).toBe("abc:1");
    expect(r2).toBe("abc:1");

    // Bypass cache when factory returns null
    const [r3] = await proc("abc", true);
    expect(r3).toBe("abc:2");
  });

  it("should infer args across factory, key, and tags when tuple generic P is provided", async () => {
    let callCount = 0;
    const proc = procedure
      .cache<[id: string, variant: "sm" | "lg"]>(({ ctx }, id) => ({
        ttl: 10000,
        key: (_o, kId, kVariant) => `typed:${ctx.userId}:${kId}:${kVariant}`,
        tags: (_o, tId) => [`typed:${tId}`],
      }))
      .query(async (_opts, id: string, variant: "sm" | "lg") => {
        callCount++;
        return `${id}:${variant}:${callCount}`;
      });

    const [a] = await proc("p1", "sm");
    const [b] = await proc("p1", "sm");
    expect(a).toBe("p1:sm:1");
    expect(b).toBe("p1:sm:1");
  });

  it("should pass (opts, ...args) and support dynamic factory in .invalidate()", async () => {
    let count = 0;
    const getItem = procedure
      .cache({
        ttl: 10000,
        key: ({ ctx }, id: string) => `inv:${ctx.userId}:${id}`,
        tags: (_o, id: string) => [`inv-tag:${id}`],
      })
      .query(async (_opts, id: string) => {
        count++;
        return `${id}-${count}`;
      });

    const updateWithArgs = procedure
      .invalidate({
        tags: (_o, id: string) => `inv-tag:${id}`,
      })
      .mutation(async (_opts, id: string) => `updated:${id}`);

    const updateDynamic = procedure
      .invalidate<[id: string, skip?: boolean]>(({ ctx }, id, skip) => {
        if (skip) return null;
        return {
          keys: () => `inv:${ctx.userId}:${id}`,
        };
      })
      .mutation(async (_opts, id: string, _skip?: boolean) => `dyn:${id}`);

    expect((await getItem("x1"))[0]).toBe("x1-1");
    expect((await getItem("x1"))[0]).toBe("x1-1");

    // Invalidate via (opts, ...args) in tags
    await updateWithArgs("x1");
    expect((await getItem("x1"))[0]).toBe("x1-2");

    // Dynamic invalidate returning null skips invalidation
    await updateDynamic("x1", true);
    expect((await getItem("x1"))[0]).toBe("x1-2");

    // Dynamic invalidate returning keys clears cache
    await updateDynamic("x1", false);
    expect((await getItem("x1"))[0]).toBe("x1-3");
  });
});

describe("Infrastructure: Rate Limiting", () => {
  it("should allow custom key generation for rate limiting", async () => {
    const procedure = createProcedure({
      inputMode: "form",
      createContext: () => ({ ok: true, ctx: { ip: "1.2.3.4" } }),
    });

    const proc = procedure
      .rateLimit({
        limit: 1,
        window: "1m",
        key: ({ ctx }) => `limit:${ctx.ip}`,
      })
      .query(async () => "ok");

    await proc();
    const [_, error] = await proc();
    expect(error?.reason).toBe("RATE_LIMITED");
  });
});
