import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient } from "../../packages/react/src/client/create-client.js";
import { createHandler } from "../../packages/server/src/adapters/next/route-handler.js";
import { createProcedure } from "../../packages/server/src/core/server.js";

describe("Request Batching & Network Deduplication (Client Link)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should pool multiple concurrent queries into a single POST /api/rpc?batch=1 request", async () => {
    const fetchCalls: Array<{ url: string; method: string; body: any }> = [];

    const mockFetch = vi.fn(async (url: string, init?: any) => {
      fetchCalls.push({
        url,
        method: init?.method,
        body: JSON.parse(init?.body || "[]"),
      });

      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => [
          { id: 0, result: [{ id: "u1", name: "Alice" }, null] },
          { id: 1, result: [5, null] },
          { id: 2, result: [{ theme: "dark" }, null] },
        ],
      };
    });

    const rpc = createClient<any>({
      baseUrl: "https://api.example.com/rpc",
      batch: true, // default 10ms window
      fetch: mockFetch,
    });

    // Dispatch 3 queries in the same tick
    const p1 = rpc.user.get();
    const p2 = rpc.notifications.count({ unreadOnly: true });
    const p3 = rpc.settings.get();

    // Advance time within batch window
    await vi.advanceTimersByTimeAsync(15);

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain("?batch=1");
    expect(fetchCalls[0].method).toBe("POST");
    expect(fetchCalls[0].body).toEqual([
      { id: 0, procedure: "user.get" },
      { id: 1, procedure: "notifications.count", input: { unreadOnly: true } },
      { id: 2, procedure: "settings.get" },
    ]);

    expect(r1).toEqual([{ id: "u1", name: "Alice" }, null]);
    expect(r2).toEqual([5, null]);
    expect(r3).toEqual([{ theme: "dark" }, null]);
  });

  it("should perform network deduplication for identical concurrent queries", async () => {
    const fetchCalls: Array<{ url: string; body: any }> = [];

    const mockFetch = vi.fn(async (url: string, init?: any) => {
      fetchCalls.push({
        url,
        body: JSON.parse(init?.body || "[]"),
      });

      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => [
          { id: 0, result: [{ id: "u1", name: "Bob" }, null] },
        ],
      };
    });

    const rpc = createClient<any>({
      baseUrl: "https://api.example.com/rpc",
      batch: { delay: 10 },
      fetch: mockFetch,
    });

    // 3 components calling the EXACT same query in the same tick
    const call1 = rpc.user.get({ id: "u1" });
    const call2 = rpc.user.get({ id: "u1" });
    const call3 = rpc.user.get({ id: "u1" });

    await vi.advanceTimersByTimeAsync(15);

    const [res1, res2, res3] = await Promise.all([call1, call2, call3]);

    // Network Deduplication: Only 1 item sent over the wire!
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].body).toHaveLength(1);
    expect(fetchCalls[0].body[0]).toEqual({
      id: 0,
      procedure: "user.get",
      input: { id: "u1" },
    });

    // All 3 callers receive the resolved data
    expect(res1).toEqual([{ id: "u1", name: "Bob" }, null]);
    expect(res2).toEqual([{ id: "u1", name: "Bob" }, null]);
    expect(res3).toEqual([{ id: "u1", name: "Bob" }, null]);
  });

  it("should flush immediately when reaching maxBatchSize without waiting for delay", async () => {
    let flushed = false;
    const mockFetch = vi.fn(async (_url: string, init?: any) => {
      flushed = true;
      const items = JSON.parse(init?.body || "[]");
      return {
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () =>
          items.map((it: any) => ({
            id: it.id,
            result: [`result-${it.id}`, null],
          })),
      };
    });

    const rpc = createClient<any>({
      baseUrl: "https://api.example.com/rpc",
      batch: { delay: 100, maxBatchSize: 3 },
      fetch: mockFetch,
    });

    // Dispatch 3 queries (matches maxBatchSize)
    const p1 = rpc.item.get({ id: 1 });
    const p2 = rpc.item.get({ id: 2 });
    const p3 = rpc.item.get({ id: 3 });

    // Without advancing timer by 100ms, it should already flush synchronously/next tick!
    expect(flushed).toBe(true);

    const results = await Promise.all([p1, p2, p3]);
    expect(results[0]).toEqual(["result-0", null]);
    expect(results[1]).toEqual(["result-1", null]);
    expect(results[2]).toEqual(["result-2", null]);
  });

  it("should allow individual queries to bypass batching via batch: false", async () => {
    const standaloneCalls: string[] = [];
    const batchCalls: string[] = [];

    const mockFetch = vi.fn(async (url: string, init?: any) => {
      if (url.includes("batch=1")) {
        batchCalls.push(url);
        return {
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => [{ id: 0, result: ["batched", null] }],
        };
      } else {
        standaloneCalls.push(url);
        return {
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => "standalone",
        };
      }
    });

    const rpc = createClient<any>({
      baseUrl: "https://api.example.com/rpc",
      batch: true,
      fetch: mockFetch,
    });

    // Query 1: standard batched query
    const p1 = rpc.batched.get();
    // Query 2: bypasses batching
    const p2 = rpc.urgent.get(undefined, { batch: false });

    // Urgent call fires immediately
    expect(standaloneCalls).toHaveLength(1);
    expect(standaloneCalls[0]).toContain("/urgent.get");

    await vi.advanceTimersByTimeAsync(15);
    await Promise.all([p1, p2]);

    expect(batchCalls).toHaveLength(1);
  });

  it("should integrate end-to-end with server createHandler batch processing", async () => {
    vi.useRealTimers();

    const proc = createProcedure();

    const router = {
      user: {
        get: proc.query(async ({ input }: { input?: { id: string } }) => {
          return { id: input?.id ?? "guest", name: "Alice" };
        }),
      },
      notifications: {
        count: proc.query(async () => {
          return 7;
        }),
      },
      failProc: proc.query(async () => {
        throw new Error("Simulated failure in procedure");
      }),
    };

    const handler = createHandler(router);

    // Create client using local handler
    const mockFetch = async (url: string, init?: any) => {
      const req = new Request(url, {
        method: init?.method,
        headers: init?.headers,
        body: init?.body,
      });
      return await handler(req);
    };

    const rpc = createClient<any>({
      baseUrl: "https://localhost/api/rpc",
      batch: { delay: 5 },
      fetch: mockFetch,
    });

    const p1 = rpc.user.get({ id: "user_42" });
    const p2 = rpc.notifications.count();
    const p3 = rpc.failProc();

    const [res1, res2, res3] = await Promise.all([p1, p2, p3]);

    // 1. Success item
    expect(res1[0]).toEqual({ id: "user_42", name: "Alice" });
    expect(res1[1]).toBeNull();

    // 2. Success item
    expect(res2[0]).toBe(7);
    expect(res2[1]).toBeNull();

    // 3. Error isolation: only failProc receives error, others succeed!
    expect(res3[0]).toBeNull();
    expect(res3[1]).toBeDefined();
    expect(res3[1].message).toBe("Simulated failure in procedure");
  });
});
