import { describe, it, expect, vi } from "vitest";
import { createProcedure } from "../../packages/server/src/core/server.js";

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

  it("should expose terminal type to middleware in both opts.type and ctx.type", async () => {
    let capturedQueryType: string | undefined;
    let capturedQueryCtxType: string | undefined;
    let capturedMutationType: string | undefined;
    let capturedMutationCtxType: string | undefined;

    const mw = procedure.middleware(({ ctx, type, next }) => {
      if (type === "query") {
        capturedQueryType = type;
        capturedQueryCtxType = ctx.type;
      } else if (type === "mutation") {
        capturedMutationType = type;
        capturedMutationCtxType = ctx.type;
      }
      return next();
    });

    const queryProc = procedure.use(mw).query(async () => "query result");
    const mutationProc = procedure.use(mw).mutation(async () => "mutation result");

    await queryProc();
    await mutationProc();

    expect(capturedQueryType).toBe("query");
    expect(capturedQueryCtxType).toBe("query");
    expect(capturedMutationType).toBe("mutation");
    expect(capturedMutationCtxType).toBe("mutation");
  });

  it("supports tenant checking and auto-injection on mutations while bypassing queries", async () => {
    const availableTenants = [{ id: "tenant-1", name: "Main Organization" }];

    const tenantMw = procedure.middleware(async ({ ctx, input, type, next }) => {
      // Queries don't require tenant selection
      if (type === "query") {
        return next();
      }

      // For form submissions / mutations:
      if (availableTenants.length === 1) {
        if (input && typeof input === "object") {
          input.tenantId = availableTenants[0].id;
        }
        return next({ tenantId: availableTenants[0].id });
      }

      if (!input?.tenantId) {
        return {
          success: false,
          message: "Please select a tenant to proceed.",
          reason: "TENANT_REQUIRED",
          statusCode: 400,
        };
      }

      return next({ tenantId: input.tenantId });
    });

    const queryEndpoint = procedure.use(tenantMw).query(async () => ({ status: "ok" }));
    const passthrough = { parse: (data: any) => ({ success: true, data }) };
    const formMutation = procedure
      .input(passthrough)
      .use(tenantMw)
      .mutation(async ({ input, ctx }) => ({
        submittedTenantId: (input as any).tenantId,
        ctxTenantId: (ctx as any).tenantId,
      }));

    // Query succeeds without tenantId
    const [qRes, qErr] = await queryEndpoint();
    expect(qErr).toBeNull();
    expect(qRes).toEqual({ status: "ok" });

    // Mutation auto-injects single tenant
    const [mRes, mErr] = await formMutation({ title: "New Resource" });
    expect(mErr).toBeNull();
    expect(mRes?.submittedTenantId).toBe("tenant-1");
    expect(mRes?.ctxTenantId).toBe("tenant-1");

    // When multiple tenants exist:
    availableTenants.push({ id: "tenant-2", name: "Secondary Organization" });

    // Mutation without tenantId fails
    const [errRes, err] = await formMutation({ title: "New Resource" });
    expect(errRes).toBeNull();
    expect(err?.reason).toBe("TENANT_REQUIRED");
    expect(err?.statusCode).toBe(400);

    // Mutation with explicit tenantId succeeds
    const [succRes, succErr] = await formMutation({ title: "New Resource", tenantId: "tenant-2" });
    expect(succErr).toBeNull();
    expect(succRes?.submittedTenantId).toBe("tenant-2");
  });

  it("propagates root middlewares and plugins context types to terminals", async () => {
    const rootProc = createProcedure({
      createContext: () => ({ ok: true, ctx: { tenantId: "tenant-123" } }),
      middlewares: [
        ({ next, ctx }) => next({ fromRootMw: "mw-ok" }),
      ],
      plugins: [
        {
          onBefore({ next, ctx }) {
            return next({ fromRootPlugin: "plugin-ok" });
          },
        },
      ],
    });

    const endpoint = rootProc.query(async ({ ctx }) => {
      return {
        tenant: ctx.tenantId,
        mw: ctx.fromRootMw,
        plugin: ctx.fromRootPlugin,
      };
    });

    const [res, err] = await endpoint();
    expect(err).toBeNull();
    expect(res).toEqual({
      tenant: "tenant-123",
      mw: "mw-ok",
      plugin: "plugin-ok",
    });

    const extendedProc = rootProc.extend({
      createContext: (ctx: any) => ({ ok: true, ctx: { ...ctx, regionId: "us-east" } }),
    });

    const extendedEndpoint = extendedProc.query(async ({ ctx }) => {
      return {
        tenant: ctx.tenantId,
        mw: ctx.fromRootMw,
        plugin: ctx.fromRootPlugin,
        region: ctx.regionId,
      };
    });

    const [extRes, extErr] = await extendedEndpoint();
    expect(extErr).toBeNull();
    expect(extRes).toEqual({
      tenant: "tenant-123",
      mw: "mw-ok",
      plugin: "plugin-ok",
      region: "us-east",
    });
  });
});
