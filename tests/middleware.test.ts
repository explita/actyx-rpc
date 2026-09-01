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

  it("plugin.onError can return an object to override the error response", async () => {
    const errorPlugin = {
      onError: async ({ error }: any) => {
        return {
          message: "Plugin intercepted error",
          reason: "PLUGIN_ERROR",
          statusCode: 418,
        };
      },
    };

    const proc = procedure.use(errorPlugin).query(async () => {
      return {
        success: false,
        message: "original",
        reason: "UNEXPECTED_ERROR",
      };
    });

    const [result, error] = await proc();
    expect(result).toBeNull();
    expect(error?.message).toBe("Plugin intercepted error");
    expect(error?.reason).toBe("PLUGIN_ERROR");
    expect(error?.statusCode).toBe(418);
  });

  it("plugin.onError can override errors from thrown exceptions", async () => {
    const errorPlugin = {
      onError: async () => {
        return { message: "Caught by plugin", statusCode: 503 };
      },
    };

    const proc = procedure.use(errorPlugin).query(async () => {
      throw new Error("boom");
    });

    const [result, error] = await proc();
    expect(result).toBeNull();
    expect(error?.message).toBe("Caught by plugin");
    expect(error?.statusCode).toBe(503);
  });

  it("plugin.onError returning void falls through to default error handling", async () => {
    const spy = vi.fn();
    const noopPlugin = {
      onError: async () => {
        spy();
      },
    };

    const proc = procedure.use(noopPlugin).query(async () => {
      throw new Error("original error");
    });

    const [result, error] = await proc();
    expect(spy).toHaveBeenCalled();
    expect(result).toBeNull();
    expect(error?.message).toBe("original error");
  });

  it("middleware extra args (adapter context) are passed through", async () => {
    const trackingMw = procedure.middleware(({ ctx, next }, request: any) => {
      return next({ url: request?.url ?? "unknown" });
    });

    const proc = procedure.use(trackingMw).query(async ({ ctx }) => {
      //@ts-ignore
      return ctx.url;
    });

    // Simulate adapter passing a Request-like arg
    const [result] = await (proc as any)(
      {},
      { url: "https://example.com/api" },
    );
    expect(result).toBe("https://example.com/api");
  });

  it("plugin.validate can enrich input data", async () => {
    const enrichPlugin = {
      validate: (input: any) => {
        return { success: true, data: { computed: input.name?.toUpperCase() } };
      },
    };

    // Create a procedure with a passthrough input resolver
    const withInput = createProcedure({
      inputMode: "form",
      createContext: () => ({ ok: true, ctx: {} }),
    });

    const passthroughResolver = {
      parse: (data: any) => ({ success: true, data }),
    };

    const proc = withInput
      .input(passthroughResolver)
      .use(enrichPlugin)
      .query(async ({ input }) => {
        return (input as any).computed;
      });

    const [result] = await proc({ name: "alice" });
    expect(result).toBe("ALICE");
  });
});
