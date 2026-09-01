/**
 * Tests for the Next.js adapter (createRouteHandler).
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRouteHandler } from "../src/adapters/next/index.js";

// Mock the next-headers module so the adapter doesn't need actual Next.js
vi.mock("../src/adapters/next/next-headers.js", () => ({
  nextAdapter: vi.fn(async () => ({
    headers: new Headers(),
    cookies: new Map(),
    // No params — real Next.js passes params via context, not nextAdapter
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

describe("createRouteHandler", () => {
  describe("procedure routing", () => {
    it("should return 400 when procedure param is missing", async () => {
      const handler = createRouteHandler({});
      const req = createRequest("http://localhost/api");
      const res = await handler(req, {});
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("Procedure parameter required");
    });

    it("should return 404 when procedure is not found", async () => {
      const handler = createRouteHandler({ user: {} });
      const req = createRequest("http://localhost/api?procedure=user.nonexistent");
      const res = await handler(req, {});
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.message).toContain("not found");
    });

    it("should call a simple query procedure", async () => {
      const mockProc = vi.fn(async (input: any) => {
        return [{ name: "Alice" }, null];
      });
      mockProc._def = { type: "query" };

      const handler = createRouteHandler({ user: mockProc });
      const req = createRequest("http://localhost/api?procedure=user");
      const res = await handler(req, {});

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ name: "Alice" });
      expect(mockProc).toHaveBeenCalled();
    });

    it("should return error status from procedure", async () => {
      const mockProc = vi.fn(async () => {
        return [null, { message: "Not found", reason: "NOT_FOUND", statusCode: 404, handlerName: "test", success: false }];
      });
      mockProc._def = { type: "query" };

      const handler = createRouteHandler({ user: mockProc });
      const req = createRequest("http://localhost/api?procedure=user");
      const res = await handler(req, {});

      expect(res.status).toBe(404);
    });

    it("should parse input from POST body", async () => {
      const mockProc = vi.fn(async (input: any) => {
        return [input, null];
      });
      mockProc._def = { type: "mutation" };

      const handler = createRouteHandler({ user: mockProc });
      const req = createRequest(
        "http://localhost/api?procedure=user",
        "POST",
        { input: { name: "Bob" } },
      );
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

      const handler = createRouteHandler({ user: mockProc });
      const req = createRequest(
        'http://localhost/api?procedure=user&input={"name":"Bob"}',
      );
      const res = await handler(req, {});

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ name: "Bob" });
    });

    it("should handle dot-separated procedure paths", async () => {
      const mockProc = vi.fn(async () => [{ ok: true }, null]);
      mockProc._def = { type: "query" };

      const handler = createRouteHandler({ admin: { users: mockProc } });
      const req = createRequest("http://localhost/api?procedure=admin.users");
      const res = await handler(req, {});

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ ok: true });
    });
  });

  describe("webRoute", () => {
    it("should call webRoute handler directly", async () => {
      const webRoute = vi.fn(async (req: Request, options: any) => {
        return new Response(JSON.stringify({ web: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
      webRoute._def = { type: "webRoute" };

      const handler = createRouteHandler(webRoute);
      const req = createRequest("http://localhost/api?procedure=web");
      const res = await handler(req, {});

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

      const handler = createRouteHandler({ nested: webRoute });
      const req = createRequest("http://localhost/api?procedure=nested");
      const res = await handler(req, {});

      expect(res.status).toBe(200);
    });
  });

  describe("context passing", () => {
    it("should pass params from context", async () => {
      let capturedOptions: any;
      const mockProc = vi.fn(async (input: any, options: any) => {
        capturedOptions = options;
        return [{ ok: true }, null];
      });
      mockProc._def = { type: "query" };

      const handler = createRouteHandler({ user: mockProc });
      const req = createRequest("http://localhost/api?procedure=user");
      const res = await handler(req, { params: Promise.resolve({ id: "123" }) });

      expect(res.status).toBe(200);
      expect(capturedOptions.params).toEqual({ id: "123" });
    });
  });
});
