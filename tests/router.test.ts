import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProcedure } from "../src/core/server.js";
import { createRouter } from "../src/core/router.js";
import { createRouteHandler } from "../src/adapters/next/index.js";
import { createClient } from "../src/client/sdk.js";
import { zodResolver } from "../src/resolvers/zod/index.js";
import { z } from "zod";

describe("Router & SDK Integration", () => {
  const procedure = createProcedure({
    inputMode: "strict",
    createContext: () => ({ ok: true, ctx: {} }),
  });

  const postsRouter = createRouter({
    list: procedure
      .input(zodResolver(z.object({ limit: z.number().optional() })))
      .query(async ({ input }) => {
        return { posts: [{ id: 1, title: "Hello World" }], limit: input?.limit ?? 10 };
      }),
    create: procedure
      .input(zodResolver(z.object({ title: z.string() })))
      .mutation(async ({ input }) => {
        return { id: 2, title: input.title };
      }),
    streamEvents: procedure
      .input(zodResolver(z.object({ count: z.number() })))
      .stream(async function* ({ input }) {
        for (let i = 0; i < input.count; i++) {
          yield { eventId: i, message: `Event ${i}` };
        }
      }),
    sseEvents: procedure
      .input(zodResolver(z.object({ count: z.number() })))
      .sse(async function* ({ input }) {
        for (let i = 0; i < input.count; i++) {
          yield { event: "message", data: { eventId: i, message: `Event ${i}` } };
        }
      }),
  });

  const appRouter = createRouter({
    posts: postsRouter,
    health: procedure.query(async () => "ok"),
  });

  type AppRouter = typeof appRouter;

  it("should resolve and execute queries correctly through route handler", async () => {
    const handler = createRouteHandler(appRouter);

    // GET Query
    const req = new Request("http://localhost/api/rpc?procedure=posts.list&input=" + encodeURIComponent(JSON.stringify({ limit: 5 })), {
      method: "GET",
    });
    const res = await handler(req, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      posts: [{ id: 1, title: "Hello World" }],
      limit: 5,
    });
  });

  it("should resolve and execute mutations correctly through route handler", async () => {
    const handler = createRouteHandler(appRouter);

    // POST Mutation
    const req = new Request("http://localhost/api/rpc?procedure=posts.create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: { title: "New Post" } }),
    });
    const res = await handler(req, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      id: 2,
      title: "New Post",
    });
  });

  it("should handle sse/stream procedures through route handler", async () => {
    const handler = createRouteHandler(appRouter);

    // SSE Procedure
    const req = new Request("http://localhost/api/rpc?procedure=posts.sseEvents&input=" + encodeURIComponent(JSON.stringify({ count: 2 })), {
      method: "GET",
    });
    const res = await handler(req, {});
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await res.text();
    expect(text).toContain("event: message");
    expect(text).toContain("data: {\"eventId\":0,\"message\":\"Event 0\"}");
    expect(text).toContain("data: {\"eventId\":1,\"message\":\"Event 1\"}");
  });

  it("should handle stream procedures mapped to sse through route handler", async () => {
    const handler = createRouteHandler(appRouter);

    // Stream Procedure
    const req = new Request("http://localhost/api/rpc?procedure=posts.streamEvents&input=" + encodeURIComponent(JSON.stringify({ count: 2 })), {
      method: "GET",
    });
    const res = await handler(req, {});
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await res.text();
    expect(text).toContain("data: {\"eventId\":0,\"message\":\"Event 0\"}");
    expect(text).toContain("data: {\"eventId\":1,\"message\":\"Event 1\"}");
  });

  it("should proxy SDK calls and execute fetches correctly", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
      const parsedUrl = new URL(url);
      const proc = parsedUrl.searchParams.get("procedure");
      const body = opts.body ? JSON.parse(opts.body) : {};

      if (proc === "posts.list") {
        return {
          ok: true,
          json: async () => ({ posts: [], limit: body.input?.limit ?? 10 }),
        };
      }
      if (proc === "posts.create") {
        return {
          ok: true,
          json: async () => ({ id: 10, title: body.input?.title }),
        };
      }
      return { ok: false, status: 404 };
    });

    const client = createClient<AppRouter>({
      baseUrl: "http://localhost/api/rpc",
      fetch: mockFetch as any,
    });

    // Test direct call (Query)
    const [qResult, qError] = await client.posts.list({ limit: 20 });
    expect(qError).toBeNull();
    expect(qResult).toEqual({ posts: [], limit: 20 });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/api/rpc?procedure=posts.list",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ input: { limit: 20 } }),
      })
    );

    // Test direct call (Mutation)
    const [mResult, mError] = await client.posts.create({ title: "SDK Test" });
    expect(mError).toBeNull();
    expect(mResult).toEqual({ id: 10, title: "SDK Test" });

    // Test .fetch() method
    const [fResult] = await client.posts.list.fetch({ limit: 15 });
    expect(fResult).toEqual({ posts: [], limit: 15 });
  });
});
