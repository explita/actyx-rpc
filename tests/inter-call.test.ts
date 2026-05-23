import { describe, it, expect, vi } from "vitest";
import { createProcedure } from "../src/core/server.js";
import { zodResolver } from "../src/resolvers/zod/index.js";
import { z } from "zod";

describe("Core: Inter-Procedure Calling", () => {
  it("should allow calling another procedure directly and share context", async () => {
    const contextSpy = vi.fn(() => ({
      ok: true as const,
      ctx: { userId: "user_1" },
    }));

    const procedure = createProcedure({
      createContext: contextSpy,
    });

    const getProfile = procedure.query(async ({ ctx }) => {
      return { id: ctx.userId, source: "getProfile" };
    });

    const getDashboard = procedure.query(async ({ ctx }) => {
      // Call getProfile internally directly
      const [profile, error] = await getProfile();

      if (error) throw error;

      return {
        dashboard: true,
        profile,
        // Verify we can access our own context too
        currentUserId: ctx.userId,
      };
    });

    const [result, error] = await getDashboard();

    expect(error).toBeNull();
    expect(result?.dashboard).toBe(true);
    expect(result?.profile?.id).toBe("user_1");
    expect(result?.currentUserId).toBe("user_1");

    // CRITICAL: createContext should only be called ONCE for the entire chain
    expect(contextSpy).toHaveBeenCalledTimes(1);
  });

  it("should handle nested inter-calls", async () => {
    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: { val: 1 } }),
    });

    const procC = procedure.query(async ({ ctx }) => ctx.val + 2);
    const procB = procedure.query(async ({ ctx }) => {
      const [res] = await procC();
      return (res || 0) + 10;
    });
    const procA = procedure.query(async ({ ctx }) => {
      const [res] = await procB();
      return (res || 0) + 100;
    });

    const [result] = await procA();
    expect(result).toBe(113); // 1 + 2 + 10 + 100
  });

  it("should pass input correctly to internal calls", async () => {
    const procedure = createProcedure({
      createContext: () => ({ ok: true, ctx: {} }),
    });

    const multiply = procedure
      .input(zodResolver(z.object({ a: z.number(), b: z.number() })))
      .query(async ({ input }) => {
        return input.a * input.b;
      });

    const calculate = procedure.query(async ({ ctx }) => {
      const [res] = await multiply({ a: 5, b: 10 });
      return res;
    });

    const [result] = await calculate();
    expect(result).toBe(50);
  });
});
