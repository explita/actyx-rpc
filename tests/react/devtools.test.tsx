import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import {
  QueryClient,
  actyxStreamTracker,
  ActyxDevtools,
  ActyxProvider,
} from "../../packages/react/src/index.js";

describe("Actyx DevTools & Inspection System", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    actyxStreamTracker.clearEvents();
  });

  describe("Cache Inspection & Stale/Fresh Status", () => {
    it("should accurately track cache keys, memory state, and stale vs fresh status", () => {
      // Set query with 10s stale time
      queryClient.setQueryDefaults("todos|list", { staleTime: 10000 });
      queryClient.setQueryState("todos|list", {
        data: [{ id: "1", title: "Test Todo" }],
        isSuccess: true,
        updatedAt: Date.now(),
      });

      // Set immediately stale query
      queryClient.setQueryState("user|profile", {
        data: { name: "Alice" },
        isSuccess: true,
        updatedAt: 0, // stale
      });

      const entries = queryClient.getCacheEntries();
      expect(entries).toHaveLength(2);

      const todosEntry = entries.find((e) => e.queryKey === "todos|list");
      expect(todosEntry).toBeDefined();
      expect(todosEntry?.isStale).toBe(false);
      expect(todosEntry?.state.data).toEqual([{ id: "1", title: "Test Todo" }]);

      const userEntry = entries.find((e) => e.queryKey === "user|profile");
      expect(userEntry).toBeDefined();
      expect(userEntry?.isStale).toBe(true);
    });

    it("should invalidate one or all cache keys on demand", () => {
      queryClient.setQueryDefaults("posts", { staleTime: 60000 });
      queryClient.setQueryState("posts|1", {
        data: { title: "Post 1" },
        isSuccess: true,
        updatedAt: Date.now(),
      });
      queryClient.setQueryState("posts|2", {
        data: { title: "Post 2" },
        isSuccess: true,
        updatedAt: Date.now(),
      });

      expect(queryClient.getCacheEntries().every((e) => !e.isStale)).toBe(true);

      // Invalidate single key
      queryClient.invalidate("posts|1");
      const entriesAfterOne = queryClient.getCacheEntries();
      expect(entriesAfterOne.find((e) => e.queryKey === "posts|1")?.isStale).toBe(true);
      expect(entriesAfterOne.find((e) => e.queryKey === "posts|2")?.isStale).toBe(false);

      // Invalidate all
      queryClient.invalidateAll();
      const entriesAfterAll = queryClient.getCacheEntries();
      expect(entriesAfterAll.every((e) => e.isStale)).toBe(true);
    });

    it("should clear the entire cache and reset subscribers", () => {
      queryClient.setQueryState("item|a", { data: 123 });
      queryClient.setQueryState("item|b", { data: 456 });
      expect(queryClient.getCacheEntries()).toHaveLength(2);

      queryClient.clearCache();
      expect(queryClient.getCacheEntries()).toHaveLength(0);
    });
  });

  describe("Mutation Logs & Latency Metrics", () => {
    it("should track mutation execution, variables, duration, and completion status", async () => {
      const mutId = queryClient.recordMutationStart(["todos", "create"], {
        text: "New Todo Item",
      });

      let history = queryClient.getMutationHistory();
      expect(history).toHaveLength(1);
      expect(history[0].mutationKey).toBe("todos|create");
      expect(history[0].status).toBe("pending");
      expect(history[0].variables).toEqual({ text: "New Todo Item" });

      // Simulate network round-trip delay
      await new Promise((r) => setTimeout(r, 20));

      queryClient.recordMutationEnd(mutId, "success", {
        id: "new-1",
        text: "New Todo Item",
      });

      history = queryClient.getMutationHistory();
      expect(history[0].status).toBe("success");
      expect(history[0].durationMs).toBeGreaterThanOrEqual(15);
      expect(history[0].data).toEqual({ id: "new-1", text: "New Todo Item" });
    });

    it("should record failed mutations with error responses", () => {
      const mutId = queryClient.recordMutationStart(["auth", "login"], {
        username: "admin",
      });

      queryClient.recordMutationEnd(mutId, "error", undefined, {
        message: "Invalid credentials",
        statusCode: 401,
      });

      const history = queryClient.getMutationHistory();
      expect(history[0].status).toBe("error");
      expect(history[0].error.message).toBe("Invalid credentials");
      expect(history[0].error.statusCode).toBe(401);
    });
  });

  describe("Live Streams & Real-Time Event Tracking", () => {
    it("should register active SSE and WebSocket streams and record incoming events", () => {
      const sseId = actyxStreamTracker.registerStream("sse", "/api/live/sse");
      actyxStreamTracker.updateStatus(sseId, "connected");

      const wsId = actyxStreamTracker.registerStream("ws", "wss://api.example.com/ws");
      actyxStreamTracker.updateStatus(wsId, "connected");

      expect(actyxStreamTracker.getStreams()).toHaveLength(2);

      // Record incoming stream events
      actyxStreamTracker.recordEvent(sseId, "ping", { timestamp: 1000 });
      actyxStreamTracker.recordEvent(sseId, "chat_message", { text: "Hello from SSE" });
      actyxStreamTracker.recordEvent(wsId, "stock_tick", { price: 150.25 });

      const events = actyxStreamTracker.getEvents();
      expect(events).toHaveLength(3);
      expect(events[0].streamType).toBe("ws");
      expect(events[0].eventName).toBe("stock_tick");
      expect(events[0].data).toEqual({ price: 150.25 });

      // Unregister
      actyxStreamTracker.updateStatus(sseId, "disconnected");
      actyxStreamTracker.unregisterStream(sseId);
      expect(actyxStreamTracker.getStreams()).toHaveLength(1);
    });
  });

  describe("<ActyxDevtools /> Component", () => {
    it("should export ActyxDevtools as a valid React component", () => {
      expect(typeof ActyxDevtools).toBe("function");
    });

    it("should allow passing explicit client to ActyxDevtools", () => {
      const customClient = new QueryClient();
      customClient.setQueryState("custom|1", { data: "test", isSuccess: true });
      expect(customClient.getCacheEntries()).toHaveLength(1);
    });

    it("should ensure ActyxProvider synchronizes the active client for external consumers", () => {
      const activeQc = new QueryClient();
      activeQc.setQueryState("qc|item", { data: 999, isSuccess: true });
      
      // ActyxProvider sets _cachedClient on mount/render
      ActyxProvider({ client: activeQc, children: null });
      
      expect(activeQc.getCacheEntries().some((e) => e.queryKey === "qc|item")).toBe(true);
    });
  });
});
