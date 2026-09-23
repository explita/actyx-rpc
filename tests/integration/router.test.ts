import { describe, it, expect, vi, beforeEach } from "vitest";
import { createProcedure } from "../../packages/server/src/core/server.js";
import { createRouter } from "../../packages/server/src/core/router.js";
import { createHandler } from "../../packages/server/src/adapters/next/index.js";
import { createClient } from "../../packages/react/src/client/create-client.js";
import { zodResolver } from "../../packages/server/src/resolvers/zod/index.js";
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
        return {
          posts: [{ id: 1, title: "Hello World" }],
          limit: input?.limit ?? 10,
        };
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
          yield {
            event: "message",
            data: { eventId: i, message: `Event ${i}` },
          };
        }
      }),
  });

  const appRouter = createRouter({
    posts: postsRouter,
    health: procedure.query(async () => "ok"),
  });

  type AppRouter = typeof appRouter;

  it("should resolve and execute queries correctly through route handler", async () => {
    const handler = createHandler(appRouter);

    // GET Query
    const req = new Request(
      "http://localhost/api/rpc?procedure=posts.list&input=" +
        encodeURIComponent(JSON.stringify({ limit: 5 })),
      {
        method: "GET",
      },
    );
    const res = await handler(req, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      posts: [{ id: 1, title: "Hello World" }],
      limit: 5,
    });
  });

  it("should resolve and execute mutations correctly through route handler", async () => {
    const handler = createHandler(appRouter);

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
    const handler = createHandler(appRouter);

    // SSE Procedure
    const req = new Request(
      "http://localhost/api/rpc?procedure=posts.sseEvents&input=" +
        encodeURIComponent(JSON.stringify({ count: 2 })),
      {
        method: "GET",
      },
    );
    const res = await handler(req, {});
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await res.text();
    expect(text).toContain("event: message");
    expect(text).toContain('data: {"eventId":0,"message":"Event 0"}');
    expect(text).toContain('data: {"eventId":1,"message":"Event 1"}');
  });

  it("should handle stream procedures mapped to sse through route handler", async () => {
    const handler = createHandler(appRouter);

    // Stream Procedure
    const req = new Request(
      "http://localhost/api/rpc?procedure=posts.streamEvents&input=" +
        encodeURIComponent(JSON.stringify({ count: 2 })),
      {
        method: "GET",
      },
    );
    const res = await handler(req, {});
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    const text = await res.text();
    expect(text).toContain('data: {"eventId":0,"message":"Event 0"}');
    expect(text).toContain('data: {"eventId":1,"message":"Event 1"}');
  });

  it("should proxy SDK calls with tRPC-style path routing", async () => {
    const mockFetch = vi
      .fn()
      .mockImplementation(async (url: string, opts: any) => {
        const parsedUrl = new URL(url);
        const proc = parsedUrl.pathname.split("/").pop();
        const inputStr = parsedUrl.searchParams.get("input");
        const input = inputStr
          ? JSON.parse(inputStr)
          : opts.body
            ? JSON.parse(opts.body).input
            : {};

        if (proc === "posts.list") {
          return {
            ok: true,
            json: async () => ({ posts: [], limit: input?.limit ?? 10 }),
          };
        }
        if (proc === "posts.create") {
          return {
            ok: true,
            json: async () => ({ id: 10, title: input?.title }),
          };
        }
        return { ok: false, status: 404 };
      });

    const client = createClient<AppRouter>({
      baseUrl: "http://localhost/api/trpc",
      fetch: mockFetch as any,
    });

    // Test direct call (Query with tRPC path-based routing defaults to GET)
    const [qResult, qError] = await client.posts.list.query({ limit: 20 });
    expect(qError).toBeNull();
    expect(qResult).toEqual({ posts: [], limit: 20 });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/api/trpc/posts.list?input=%7B%22limit%22%3A20%7D",
      expect.objectContaining({
        method: "GET",
      }),
    );

    // Test direct call (Mutation with tRPC path-based routing defaults to POST)
    const [mResult, mError] = await client.posts.create.mutate({
      title: "SDK Test",
    });
    expect(mError).toBeNull();
    expect(mResult).toEqual({ id: 10, title: "SDK Test" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/api/trpc/posts.create",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ input: { title: "SDK Test" } }),
      }),
    );
  });

  it("should support query routing mode when routing: 'query' is configured", async () => {
    const mockFetch = vi
      .fn()
      .mockImplementation(async (url: string, opts: any) => {
        const parsedUrl = new URL(url);
        const proc = parsedUrl.searchParams.get("procedure");
        const inputStr = parsedUrl.searchParams.get("input");
        const input = inputStr
          ? JSON.parse(inputStr)
          : opts.body
            ? JSON.parse(opts.body).input
            : {};

        if (proc === "posts.list") {
          return {
            ok: true,
            json: async () => ({ posts: [], limit: input?.limit ?? 10 }),
          };
        }
        return { ok: false, status: 404 };
      });

    const client = createClient<AppRouter>({
      baseUrl: "http://localhost/api/rpc",
      routing: "query",
      fetch: mockFetch as any,
    });

    const [qResult, qError] = await client.posts.list.query({ limit: 5 });
    expect(qError).toBeNull();
    expect(qResult).toEqual({ posts: [], limit: 5 });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost/api/rpc?procedure=posts.list&input=%7B%22limit%22%3A5%7D",
      expect.objectContaining({
        method: "GET",
      }),
    );
  });

  it("should execute end-to-end through createHandler using Next.js catch-all params", async () => {
    const handler = createHandler(appRouter);

    const clientFetch: typeof fetch = async (url, init) => {
      const parsed = new URL(url.toString());
      const proc = parsed.pathname.replace(/^\/api\/trpc\//, "");
      const req = new Request(url, init);
      // Simulate Next.js passing catch-all params e.g. [trpc]
      return await handler(req, { params: { trpc: proc } });
    };

    const client = createClient<AppRouter>({
      baseUrl: "http://localhost/api/trpc",
      fetch: clientFetch,
    });

    const [res, err] = await client.posts.list.query({ limit: 42 });
    expect(err).toBeNull();
    expect(res).toEqual({
      posts: [{ id: 1, title: "Hello World" }],
      limit: 42,
    });
  });

  it("should enforce that all router members are procedures or nested routers", () => {
    const validRouter = createRouter({
      sub: createRouter({
        item: procedure.query(() => "sub-item"),
      }),
      direct: procedure.query(() => "direct-item"),
    });

    expect(validRouter.direct).toBeDefined();
    expect(validRouter.sub.item).toBeDefined();

    // Type checking: passing primitive values or regular functions should be rejected
    // @ts-expect-error - string is not a procedure or router
    createRouter({ invalid: "not a procedure" });

    // @ts-expect-error - regular function without procedure _def is not a procedure
    createRouter({ invalidFn: () => "regular function" });
  });

  it("should support procedures with additional handler arguments (args: P)", async () => {
    const extraArgsRouter = createRouter({
      withInputAndArgs: procedure
        .input(zodResolver(z.object({ name: z.string() })))
        .query(async ({ input }, id: string, prefix = "Hello") => {
          return { greeting: `${prefix}, ${input.name} (#${id})` };
        }),
      noInputWithArgs: procedure.query(
        async (_, category: string, count: number) => {
          return { category, count };
        },
      ),
      mutateWithArgs: procedure
        .input(zodResolver(z.object({ title: z.string() })))
        .mutation(async ({ input }, author: string) => {
          return { title: input.title, author };
        }),
      noInputMutateWithArgs: procedure.mutation(
        async (_, actionName: string) => {
          return { executed: actionName };
        },
      ),
    });

    const handler = createHandler(extraArgsRouter);
    const clientFetch: typeof fetch = async (url, init) => {
      const parsed = new URL(url.toString());
      const proc = parsed.pathname.replace(/^\/api\/rpc\//, "");
      const req = new Request(url, init);
      return await handler(req, { params: { rpc: proc } });
    };

    const client = createClient<typeof extraArgsRouter>({
      baseUrl: "http://localhost/api/rpc",
      fetch: clientFetch,
    });

    // 1. Direct query with input and extra args
    const [res1, err1] = await client.withInputAndArgs.query(
      { name: "Alice" },
      "id-123",
      "Welcome",
    );
    expect(err1).toBeNull();
    expect(res1).toEqual({ greeting: "Welcome, Alice (#id-123)" });

    // 2. Direct query without input and with extra args
    const [res2, err2] = await client.noInputWithArgs.query("tech", 42);
    expect(err2).toBeNull();
    expect(res2).toEqual({ category: "tech", count: 42 });

    // 3. Direct mutate with input and extra args
    const [res3, err3] = await client.mutateWithArgs.mutate(
      { title: "My Post" },
      "Bob",
    );
    expect(err3).toBeNull();
    expect(res3).toEqual({ title: "My Post", author: "Bob" });

    // 4. Direct mutate without input and with extra args
    const [res4, err4] = await client.noInputMutateWithArgs.mutate("reset");
    expect(err4).toBeNull();
    expect(res4).toEqual({ executed: "reset" });
  });
});
