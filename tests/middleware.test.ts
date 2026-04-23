import { describe, it, expect, vi } from "vitest";
import { createProcedure } from "../src/core/server.js";

describe("Logic: Middleware & Plugins", () => {
  const procedure = createProcedure({
    inputMode: "form",
    createContext: () => ({ ok: true, ctx: {} }),
  });

  it("should allow middleware to block execution by not calling next()", async () => {
    const blockingMw = procedure.middleware(() => {
      return { success: false, message: "Blocked", reason: "UNAUTHORIZED" };
    });

    const handlerSpy = vi.fn();
    const proc = procedure.use(blockingMw).query(handlerSpy);

    const [result, error] = await proc();
    expect(handlerSpy).not.toHaveBeenCalled();
    expect(error?.message).toBe("Blocked");
  });

  it("should execute plugin lifecycle hooks in order", async () => {
    const order: string[] = [];

    const tracePlugin = {
      onBefore: async () => {
        order.push("before");
      },
      onAfter: async () => {
        order.push("after");
      },
    };

    const proc = procedure.use(tracePlugin).query(async () => {
      order.push("handler");
      return "done";
    });

    await proc();
    expect(order).toEqual(["before", "handler", "after"]);
  });

  it("should handle nested .use() calls and preserve all context", async () => {
    const mw1 = procedure.middleware(({ next }) => next({ a: 1 }));
    const mw2 = procedure.middleware(({ next }) => next({ b: 2 }));

    const proc = procedure
      .use(mw1)
      .use(mw2)
      .query(async ({ ctx }) => {
        //@ts-ignore
        return ctx.a + ctx.b;
      });

    const [result] = await proc();
    expect(result).toBe(3);
  });
});
