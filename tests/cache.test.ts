import { describe, it, expect, vi } from "vitest";
import { createProcedure } from "../src/core/server.js";

describe("Infrastructure: Caching", () => {
  const procedure = createProcedure({
    inputMode: "form",
    createContext: () => ({ ok: true, ctx: { userId: "u1" } }),
  });

  it("should serve results from cache on repeated calls", async () => {
    let callCount = 0;
    const proc = procedure
      .name("cached-query")
      .cache({ ttl: 1000 })
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
      .cache({ tags: ["data-tag"], ttl: 10000 })
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
