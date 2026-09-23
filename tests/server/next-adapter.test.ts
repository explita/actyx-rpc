/**
 * Tests for the Next.js adapter (createHandler).
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHandler } from "../../packages/server/src/adapters/next/index.js";

// Mock the next-headers module so the adapter doesn't need actual Next.js
vi.mock("../../packages/server/src/adapters/next/next-headers.js", () => ({
  nextAdapter: vi.fn(async () => ({
    headers: new Headers(),
    cookies: new Map(),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(
  url: string,
  method = "GET",
  body?: any,
  contentType = "application/json",
): Request {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const req = new Request(url, init);
  if (body !== undefined) {
    // Re-set content-type since Request constructor may override
    (req as any).headers?.set?.("content-type", contentType);
  }
  return req;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createHandler", () => {
  describe("procedure routing", () => {
    it("should return 400 when procedure param is missing", async () => {
      const handler = createHandler({});
      const req = createRequest("http://localhost/api");
      const res = await handler(req, {});
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("Procedure parameter required");
    });

    it("should return 404 when procedure is not found", async () => {
      const handler = createHandler({ user: {} });
      const req = createRequest(
        "http://localhost/api?procedure=user.nonexistent",
      );
      const res = await handler(req, {});
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.message.toLowerCase()).toContain("not found");
    });

    it("should call a simple query procedure", async () => {
      const mockProc = vi.fn(async (input: any) => {
        return [{ name: "Alice" }, null];
      });
      mockProc._def = { type: "query" };

      const handler = createHandler({ user: mockProc });
      const req = createRequest("http://localhost/api?procedure=user");
      const res = await handler(req, {});

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ name: "Alice" });
      expect(mockProc).toHaveBeenCalled();
    });

    it("should return error status from procedure", async () => {
      const mockProc = vi.fn(async () => {
        return [
          null,
          {
            message: "Not found",
            reason: "NOT_FOUND",
            statusCode: 404,
            handlerName: "test",
            success: false,
          },
        ];
      });
      mockProc._def = { type: "query" };

      const handler = createHandler({ user: mockProc });
      const req = createRequest("http://localhost/api?procedure=user");
      const res = await handler(req, {});

      expect(res.status).toBe(404);
    });

    it("should parse input from POST body", async () => {
      const mockProc = vi.fn(async (input: any) => {
        return [input, null];
      });
      mockProc._def = { type: "mutation" };

      const handler = createHandler({ user: mockProc });
      const req = createRequest("http://localhost/api?procedure=user", "POST", {
        input: { name: "Bob" },
      });
      const res = await handler(req, {});

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ name: "Bob" });
    });

    it("should parse input from GET searchParams", async () => {
      const mockProc = vi.fn(async (input: any) => {
        return [input, null];
      });
      mockProc._def = { type: "query" };

      const handler = createHandler({ user: mockProc });
      const req = createRequest(
        'http://localhost/api?procedure=user&input={"name":"Bob"}',
      );
      const res = await handler(req, {});

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ name: "Bob" });
    });

    it("should parse input and args from GET searchParams", async () => {
      const mockProc = vi.fn(
        async (input: any, role: string, flag: boolean) => {
          return [{ input, role, flag }, null];
        },
      );
      mockProc._def = { type: "query" };

      const handler = createHandler({ user: mockProc });
      const req = createRequest(
        'http://localhost/api?procedure=user&input={"id":"123"}&args=["admin",true]',
      );
      const res = await handler(req, {});

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ input: { id: "123" }, role: "admin", flag: true });
      expect(mockProc).toHaveBeenCalledWith({ id: "123" }, "admin", true);
    });

    it("should handle dot-separated procedure paths", async () => {
      const mockProc = vi.fn(async () => [{ ok: true }, null]);
      mockProc._def = { type: "query" };

      const handler = createHandler({ admin: { users: mockProc } });
      const req = createRequest("http://localhost/api?procedure=admin.users");
      const res = await handler(req, {});

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });
  });

  describe("webRoute", () => {
    it("should execute standalone webRoute directly as Next.js route handler", async () => {
      const webRoute = vi.fn(async (req: Request, options: any) => {
        return new Response(JSON.stringify({ web: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
      webRoute._def = { type: "webRoute" };

      const req = createRequest("http://localhost/api");
      const res = await webRoute(req, {});

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ web: true });
    });

    it("should call nested webRoute directly", async () => {
      const webRoute = vi.fn(async (req: Request, options: any) => {
        return new Response(JSON.stringify({ nested: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
      webRoute._def = { type: "webRoute" };

      const handler = createHandler({ nested: webRoute });
      const req = createRequest("http://localhost/api?procedure=nested");
      const res = await handler(req, {});

      expect(res.status).toBe(200);
    });
  });

  describe("webRoute context passing", () => {
    it("should pass options with params to webRoute", async () => {
      let capturedOptions: any;
      const webRoute = vi.fn(async (req: Request, options: any) => {
        capturedOptions = options;
        return new Response(JSON.stringify({ ok: true }));
      });
      webRoute._def = { type: "webRoute" };

      const handler = createHandler({ custom: webRoute });
      const req = createRequest("http://localhost/api?procedure=custom");
      await handler(req, { params: Promise.resolve({ id: "123" }) });

      expect(capturedOptions.params).toEqual({ id: "123" });
    });
  });

  describe("tRPC-style path routing", () => {
    it("should resolve procedure from context.params.trpc string (e.g. [trpc])", async () => {
      const mockProc = vi.fn(async () => [{ name: "Alice" }, null]);
      mockProc._def = { type: "query" };

      const handler = createHandler({ user: { get: mockProc } });
      const req = createRequest("http://localhost/api/trpc/user.get");
      const res = await handler(req, { params: { trpc: "user.get" } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ name: "Alice" });
      expect(mockProc).toHaveBeenCalled();
    });

    it("should resolve procedure from context.params.trpc array (e.g. [...trpc])", async () => {
      const mockProc = vi.fn(async () => [{ name: "Bob" }, null]);
      mockProc._def = { type: "query" };

      const handler = createHandler({ admin: { users: mockProc } });
      const req = createRequest("http://localhost/api/trpc/admin/users");
      const res = await handler(req, { params: { trpc: ["admin", "users"] } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ name: "Bob" });
      expect(mockProc).toHaveBeenCalled();
    });

    it("should resolve procedure and parse input from ?input= in path-based GET query", async () => {
      let capturedInput: any;
      const mockProc = vi.fn(async (input: any) => {
        capturedInput = input;
        return [{ found: true, ...input }, null];
      });
      mockProc._def = { type: "query" };

      const handler = createHandler({ posts: { list: mockProc } });
      const req = createRequest(
        "http://localhost/api/trpc/posts.list?input=" +
          encodeURIComponent(JSON.stringify({ limit: 10, search: "hello" })),
      );
      const res = await handler(req, { params: { trpc: "posts.list" } });

      expect(res.status).toBe(200);
      expect(capturedInput).toEqual({ limit: 10, search: "hello" });
    });

    it("should fallback to URL pathname segments when context.params is not provided", async () => {
      const mockProc = vi.fn(async () => [{ name: "Charlie" }, null]);
      mockProc._def = { type: "query" };

      const handler = createHandler({ user: { profile: mockProc } });
      const req = createRequest("http://localhost/api/trpc/user.profile");
      const res = await handler(req, {});

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ name: "Charlie" });
    });

    it("should allow destructuring HTTP methods from createHandler", async () => {
      const mockProc = vi.fn(async () => [{ ok: true }, null]);
      mockProc._def = { type: "query" };

      const { GET, POST } = createHandler({ ping: mockProc });
      expect(typeof GET).toBe("function");
      expect(typeof POST).toBe("function");

      const req = createRequest("http://localhost/api/rpc/ping");
      const res = await GET(req, {});
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });

    it("should propagate req and context to procedure createContext and handler ctx via httpStorage", async () => {
      const { createProcedure } = await import(
        "../../packages/server/src/core/server.js"
      );
      const { getRequest, getHttpContext } = await import(
        "../../packages/server/src/core/helpers/rpc-storage.js"
      );

      let capturedReqInCreateCtx: any;
      let capturedContextInCreateCtx: any;
      let capturedCtxInHandler: any;
      let ambientReqInsideHandler: any;

      const procedure = createProcedure({
        createContext: async (baseCtx, req, context) => {
          capturedReqInCreateCtx = req;
          capturedContextInCreateCtx = context;
          return {
            ok: true,
            ctx: {
              authHeader: req?.headers.get("authorization"),
              routeParam: context?.params?.rpc,
            },
          };
        },
      });

      const testProc = procedure.query(async ({ ctx }) => {
        capturedCtxInHandler = ctx;
        ambientReqInsideHandler = getRequest();
        return { success: true };
      });

      const handler = createHandler({ test: testProc });
      const req = new Request("http://localhost/api/rpc/test", {
        headers: { authorization: "Bearer secret-token" },
      });
      const res = await handler(req, {
        params: Promise.resolve({ rpc: "test" }),
      });

      expect(res.status).toBe(200);
      expect(capturedReqInCreateCtx).toBeDefined();
      expect(capturedReqInCreateCtx.headers.get("authorization")).toBe(
        "Bearer secret-token",
      );
      expect(capturedContextInCreateCtx?.params?.rpc).toBe("test");
      expect(capturedCtxInHandler.authHeader).toBe("Bearer secret-token");
      expect(capturedCtxInHandler.routeParam).toBe("test");
      expect(ambientReqInsideHandler).toBeDefined();
    });

    it("should resolve procedure from nested params.slug and support primitive body", async () => {
      const { createProcedure } = await import(
        "../../packages/server/src/core/server.js"
      );

      const { zodResolver } = await import(
        "../../packages/server/src/resolvers/zod/index.js"
      );
      const { z } = await import("zod");

      let receivedInput: any;
      const proc = createProcedure()
        .input(zodResolver(z.string()))
        .mutation(async ({ input }) => {
          receivedInput = input;
          return { echo: input };
        });

      const handler = createHandler({ users: { update: proc } });
      const req = new Request("http://localhost/api/org-1/rpc/users/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify("primitive-payload-id"),
      });

      const res = await handler(req, {
        params: Promise.resolve({
          org: "org-1",
          slug: ["users", "update"],
        }),
      });

      expect(res.status).toBe(200);
      expect(receivedInput).toBe("primitive-payload-id");
      const body = await res.json();
      expect(body).toEqual({ echo: "primitive-payload-id" });
    });
  });

  describe("OPTIONS preflight handling", () => {
    it("should return 204 with Allow header on handler.OPTIONS call", async () => {
      const handler = createHandler({});
      const req = new Request("http://localhost/api/rpc", { method: "OPTIONS" });
      const res = await handler.OPTIONS(req);

      expect(res.status).toBe(204);
      expect(res.headers.get("Allow")).toBe(
        "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
      );
    });

    it("should return 204 with Allow header when invoking handler directly with OPTIONS", async () => {
      const handler = createHandler({});
      const req = new Request("http://localhost/api/rpc", { method: "OPTIONS" });
      const res = await handler(req);

      expect(res.status).toBe(204);
      expect(res.headers.get("Allow")).toBe(
        "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
      );
    });

    it("should not execute procedure when OPTIONS request is sent to a procedure route", async () => {
      const { createProcedure } = await import(
        "../../packages/server/src/core/server.js"
      );

      const executed = vi.fn();
      const deleteProc = createProcedure().mutation(async () => {
        executed();
        return { deleted: true };
      });

      const handler = createHandler({ posts: { delete: deleteProc } });
      const req = new Request("http://localhost/api/rpc/posts.delete", {
        method: "OPTIONS",
      });

      const res = await handler(req, {
        params: Promise.resolve({ rpc: ["posts", "delete"] }),
      });

      expect(res.status).toBe(204);
      expect(executed).not.toHaveBeenCalled();
    });
  });
});

