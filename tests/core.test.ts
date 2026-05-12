import { describe, it, expect, vi } from "vitest";
import { createProcedure } from "../src/core/server.js";
import { zodResolver } from "../src/resolvers/zod/index.js";
import { z } from "zod";

describe("Core: Procedure Basics", () => {
  const procedure = createProcedure({
    inputMode: "strict",
    createContext: () => ({ ok: true, ctx: { userId: "user_1" } }),
    enrichInput: (ctx) => ({ user: ctx.userId }),
  });

  it("should enrich input using context", async () => {
    const proc = procedure.query(async ({ input }) => {
      //@ts-ignore
      return input.user;
    });

    const [result] = await proc();
    expect(result).toBe("user_1");
  });

  it("should handle onSuccess lifecycle hook", async () => {
    const successSpy = vi.fn();
    const proc = createProcedure({
      inputMode: "strict",
      createContext: () => ({ ok: true, ctx: {} }),
      onSuccess: successSpy,
    })
      .input(zodResolver(z.object({ name: z.string() })))
      .query(async ({ input }) => `Hello ${input.name}`);

    await proc({ name: "Alice" });

    expect(successSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { name: "Alice" },
        output: "Hello Alice",
      }),
    );
  });
});

describe("Core: Input Modes", () => {
  const schema = z.object({ age: z.number() });
  const base = createProcedure({
    inputMode: "strict",
    createContext: () => ({ ok: true, ctx: {} }),
  });

  it("should respect strict mode", async () => {
    const proc = base
      .input(zodResolver(schema), { mode: "strict" })
      .query(async ({ input }) => input.age);

    //@ts-expect-error - Age should be number
    const [_, error] = await proc({ age: "25" });
    expect(error?.reason).toBe("VALIDATION_ERROR");
  });

  it("should allow partial updates in partial mode", async () => {
    const proc = base
      .input(
        zodResolver(z.object({ a: z.string(), b: z.number() }).partial()),
        { mode: "partial" },
      )
      .query(async ({ input }) => input);

    // Should allow passing only one key
    //@ts-ignore
    const [result] = await proc({ a: "test" });
    expect(result).toEqual({ a: "test" });
  });

  it("should merge and provide metadata in context", async () => {
    const root = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
      meta: { app: "test-app", roles: ["user"] },
    });

    const proc = root
      .meta({ roles: ["admin"], custom: 123 })
      .query(async ({ ctx }) => ctx.meta);

    const [meta] = await proc();
    expect(meta).toEqual({
      app: "test-app",
      roles: ["admin"], // Overwritten by local meta
      custom: 123,
    });
  });
});
