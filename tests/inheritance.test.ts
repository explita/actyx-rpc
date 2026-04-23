import { describe, it, expect } from "vitest";
import { createProcedure } from "../src/core/server.js";

describe("Core: Inheritance & Extension", () => {
  const base = createProcedure({
    inputMode: "strict",
    createContext: () => ({ ok: true, ctx: { userId: "u1" } }),
    enrichInput: (ctx) => ({ userId: ctx.userId, base: true }),
  });

  it("should extend and access previous enrichment", async () => {
    const extended = base.extend({
      enrichInput: async ({ previous, ctx }) => {
        return {
          ...previous,
          extended: true,
          combined: `${previous.userId}:${ctx.userId}`
        };
      }
    });

    const proc = extended.query(async ({ input }) => input);
    const [result] = await proc();

    expect(result).toEqual({
      userId: "u1",
      base: true,
      extended: true,
      combined: "u1:u1"
    });
  });
});
