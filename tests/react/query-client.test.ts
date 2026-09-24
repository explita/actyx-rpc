import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient } from "../../packages/react/src/lib/query-client.js";

describe("React: QueryClient Caching & Invalidation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.useFakeTimers();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("should initialize with empty cache and return undefined for unknown keys", () => {
    expect(queryClient.getQueryState("unknown")).toBeUndefined();
  });

  it("should set and get query state correctly", () => {
    queryClient.setQueryState("user_1", {
      data: { name: "Alice" },
      isSuccess: true,
    });

    const state = queryClient.getQueryState("user_1");
    expect(state).toBeDefined();
    expect(state?.data).toEqual({ name: "Alice" });
    expect(state?.isSuccess).toBe(true);
    expect(state?.isFetching).toBe(false);
  });

  it("should notify listeners when query state changes", () => {
    const listener = vi.fn();
    queryClient.subscribe("user_1", listener);

    queryClient.setQueryState("user_1", { data: { name: "Bob" } });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should not notify listeners when setting state silently", () => {
    const listener = vi.fn();
    queryClient.subscribe("user_1", listener);

    queryClient.setQueryState(
      "user_1",
      { data: { name: "Bob" } },
      { silent: true },
    );
    expect(listener).not.toHaveBeenCalled();
  });

  it("should garbage collect queries after unsubscribe and gcTime delay", () => {
    const listener = vi.fn();
    const unsubscribe = queryClient.subscribe("user_1", listener, 5000);

    queryClient.setQueryState("user_1", { data: "test-data" });
    expect(queryClient.getQueryState("user_1")?.data).toBe("test-data");

    // Unsubscribe triggers GC timer
    unsubscribe();

    // Data should still exist before timeout
    vi.advanceTimersByTime(4000);
    expect(queryClient.getQueryState("user_1")).toBeDefined();

    // Data should be removed after timeout
    vi.advanceTimersByTime(1001);
    expect(queryClient.getQueryState("user_1")).toBeUndefined();
  });

  it("should cancel garbage collection if resubscribed before timeout", () => {
    const listener = vi.fn();
    const unsubscribe1 = queryClient.subscribe("user_1", listener, 5000);
    queryClient.setQueryState("user_1", { data: "test-data" });

    unsubscribe1(); // triggers GC timer
    vi.advanceTimersByTime(3000);

    // Resubscribe cancels GC
    const unsubscribe2 = queryClient.subscribe("user_1", listener, 5000);
    vi.advanceTimersByTime(3000);

    expect(queryClient.getQueryState("user_1")).toBeDefined();
    expect(queryClient.getQueryState("user_1")?.data).toBe("test-data");

    unsubscribe2();
  });

  it("should update query data and return old and new data tuple via setQueryData", () => {
    queryClient.setQueryState("profile", { data: { name: "Carol" } });

    const [oldData, newData] = queryClient.setQueryData<any>(
      ["profile"],
      (old) => ({ ...old, role: "Admin" }),
    );

    expect(oldData).toEqual({ name: "Carol" });
    expect(newData).toEqual({ name: "Carol", role: "Admin" });
    expect(queryClient.getQueryState("profile")?.data).toEqual({
      name: "Carol",
      role: "Admin",
    });
  });

  it("should invalidate query keys and trigger invalidation listeners", () => {
    const listener = vi.fn();
    queryClient.onInvalidate("posts|list", listener);

    queryClient.setQueryState("posts|list", {
      data: ["post1"],
      updatedAt: Date.now(),
    });

    // Invalidate prefix matches exact key
    queryClient.invalidate(["posts", "list"]);

    const state = queryClient.getQueryState("posts|list");
    expect(state?.updatedAt).toBe(0); // Marked stale silently
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should invalidate query keys that start with invalidation prefix", () => {
    const listener = vi.fn();
    queryClient.onInvalidate("posts|list|page1", listener);

    queryClient.setQueryState("posts|list|page1", {
      data: ["post1"],
      updatedAt: Date.now(),
    });

    // Invalidate prefix matches prefix of keys
    queryClient.invalidate(["posts", "list"]);

    const state = queryClient.getQueryState("posts|list|page1");
    expect(state?.updatedAt).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should track mutations and notify mutation listeners", () => {
    const listener = vi.fn();
    queryClient.subscribeMutations(listener);

    expect(queryClient.isMutating()).toBe(false);

    queryClient.startMutation(["addTodo"]);
    expect(queryClient.isMutating()).toBe(true);
    expect(queryClient.isMutating(["addTodo"])).toBe(true);
    expect(queryClient.isMutating(["otherTodo"])).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);

    queryClient.endMutation(["addTodo"]);
    expect(queryClient.isMutating()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  describe("QueryClient Mutation Helpers", () => {
    describe("Standard Query (Arrays/Objects)", () => {
      it("should prepend and append to array correctly", () => {
        queryClient.setQueryState("arr", { data: [2, 3] });
        queryClient.prepend("arr", 1);
        expect(queryClient.getQueryState("arr")?.data).toEqual([1, 2, 3]);

        queryClient.append("arr", 4);
        expect(queryClient.getQueryState("arr")?.data).toEqual([1, 2, 3, 4]);
      });

      it("should prepend and append to object correctly (spread merge)", () => {
        queryClient.setQueryState("obj", { data: { b: 2, c: 3 } });
        queryClient.prepend("obj", { a: 1, b: 99 });
        expect(queryClient.getQueryState("obj")?.data).toEqual({ a: 1, b: 2, c: 3 });

        queryClient.append("obj", { c: 99, d: 4 });
        expect(queryClient.getQueryState("obj")?.data).toEqual({ a: 1, b: 2, c: 99, d: 4 });
      });

      it("should insert, remove, update arrays correctly", () => {
        queryClient.setQueryState("arr", { data: ["a", "b", "c"] });
        queryClient.insert("arr", 1, "x");
        expect(queryClient.getQueryState("arr")?.data).toEqual(["a", "x", "b", "c"]);

        queryClient.update("arr", 1, "y");
        expect(queryClient.getQueryState("arr")?.data).toEqual(["a", "y", "b", "c"]);

        queryClient.remove("arr", 1);
      });

      it("should support concurrent surgical rollbacks for multiple updates", () => {
        queryClient.setQueryState("arr", {
          data: [
            { id: "1", text: "A", completed: false },
            { id: "2", text: "B", completed: false },
          ],
        });

        // Optimistically update B
        const rollbackB = queryClient.update<any>(
          "arr",
          (item) => item.id === "2",
          (item) => ({ ...item, completed: true }),
        );

        // Optimistically update A
        const rollbackA = queryClient.update<any>(
          "arr",
          (item) => item.id === "1",
          (item) => ({ ...item, completed: true }),
        );

        // State is both completed
        expect(queryClient.getQueryState("arr")?.data).toEqual([
          { id: "1", text: "A", completed: true },
          { id: "2", text: "B", completed: true },
        ]);

        // Rollback B
        rollbackB();

        // A is still completed, B is reverted to false
        expect(queryClient.getQueryState("arr")?.data).toEqual([
          { id: "1", text: "A", completed: true },
          { id: "2", text: "B", completed: false },
        ]);

        // Rollback A
        rollbackA();

        // Both are reverted
        expect(queryClient.getQueryState("arr")?.data).toEqual([
          { id: "1", text: "A", completed: false },
          { id: "2", text: "B", completed: false },
        ]);
      });


      it("should discard insert, remove, update on standard object data", () => {
        const initialObj = { a: 1 };
        queryClient.setQueryState("obj", { data: initialObj });
        queryClient.insert("obj", 0, { b: 2 });
        queryClient.remove("obj", 0);
        queryClient.update("obj", 0, { b: 2 });
        expect(queryClient.getQueryState("obj")?.data).toEqual(initialObj);
      });
    });

    describe("Infinite Query (pages)", () => {
      const setupInfiniteQuery = () => {
        queryClient.setQueryState("inf", {
          data: {
            pages: [
              { data: ["a", "b"] },
              { data: ["c", "d"] }
            ],
            pageParams: [1, 2]
          }
        });
      };

      it("should prepend and append to pages correctly", () => {
        setupInfiniteQuery();
        queryClient.prepend("inf", "x");
        expect((queryClient.getQueryState("inf")?.data as any).pages[0].data).toEqual(["x", "a", "b"]);

        queryClient.append("inf", "y");
        expect((queryClient.getQueryState("inf")?.data as any).pages[1].data).toEqual(["c", "d", "y"]);
      });

      it("should insert, remove, update infinite query pages correctly", () => {
        setupInfiniteQuery();
        queryClient.insert("inf", 1, "x"); // insert between a and b
        expect((queryClient.getQueryState("inf")?.data as any).pages[0].data).toEqual(["a", "x", "b"]);

        queryClient.update("inf", 1, "y"); // updates index 1 (x) to y
        expect((queryClient.getQueryState("inf")?.data as any).pages[0].data).toEqual(["a", "y", "b"]);

        queryClient.remove("inf", 1); // removes index 1 (y)
        expect((queryClient.getQueryState("inf")?.data as any).pages[0].data).toEqual(["a", "b"]);
      });

      it("should discard insert, remove, update when infinite page data is an object", () => {
        queryClient.setQueryState("inf_obj", {
          data: {
            pages: [
              { data: { a: 1 } }
            ],
            pageParams: [1]
          }
        });

        const initialPages = JSON.parse(JSON.stringify((queryClient.getQueryState("inf_obj")?.data as any).pages));
        queryClient.insert("inf_obj", 0, { b: 2 });
        queryClient.remove("inf_obj", 0);
        queryClient.update("inf_obj", 0, { b: 2 });
        expect((queryClient.getQueryState("inf_obj")?.data as any).pages).toEqual(initialPages);
      });
    });
  });

  describe("Default / Global Options", () => {
    it("should initialize with queries and mutations config if provided", () => {
      const client = new QueryClient({
        queries: {
          staleTime: "5m",
          refetchOnWindowFocus: true,
        },
        mutations: {
          debounce: 250,
        },
      });

      expect(client.getDefaultOptions()).toEqual({
        queries: {
          staleTime: "5m",
          refetchOnWindowFocus: true,
        },
        mutations: {
          debounce: 250,
        },
      });
      expect(client.getQueryDefaults("any_key")?.staleTime).toBe("5m");
      expect(client.getQueryDefaults("any_key")?.refetchOnWindowFocus).toBe(true);
      expect(client.getMutationDefaults()?.debounce).toBe(250);
    });

    it("should update defaultOptions via setDefaultOptions", () => {
      const client = new QueryClient();
      expect(client.getDefaultOptions()).toEqual({});

      client.setDefaultOptions({
        queries: {
          staleTime: 1000,
        },
      });
      expect(client.getDefaultOptions().queries?.staleTime).toBe(1000);
      expect(client.getQueryDefaults("key")?.staleTime).toBe(1000);
    });

    it("should set and match key-specific query defaults", () => {
      const client = new QueryClient({
        queries: {
          staleTime: 1000,
          enabled: true,
        },
      });

      // Key-specific override
      client.setQueryDefaults(["users"], { staleTime: 60000 });

      // Non-matching key gets global default
      expect(client.getQueryDefaults("posts")?.staleTime).toBe(1000);
      expect(client.getQueryDefaults(["posts", 1])?.staleTime).toBe(1000);

      // Matching key gets key-specific override merged with global defaults
      expect(client.getQueryDefaults("users")?.staleTime).toBe(60000);
      expect(client.getQueryDefaults("users|123")?.staleTime).toBe(60000);
      expect(client.getQueryDefaults(["users", 123])?.staleTime).toBe(60000);
      expect(client.getQueryDefaults(["users", 123])?.enabled).toBe(true);
    });

    it("should set and match key-specific mutation defaults", () => {
      const client = new QueryClient({
        mutations: {
          debounce: 100,
        },
      });

      client.setMutationDefaults(["upload"], { debounce: 500 });

      expect(client.getMutationDefaults("other")?.debounce).toBe(100);
      expect(client.getMutationDefaults(["upload", "file"])?.debounce).toBe(500);
    });

    it("should use default gcTime in subscribe when not explicitly specified", () => {
      const client = new QueryClient({
        queries: {
          gcTime: 1000,
        },
      });

      client.setQueryState("user_gc", { data: "hello" });
      const unsub = client.subscribe("user_gc", () => {});
      unsub();

      // Should still exist immediately
      expect(client.getQueryState("user_gc")).toBeDefined();

      // Advance by 1000ms (the configured gcTime)
      vi.advanceTimersByTime(1000);

      // Should have been garbage collected
      expect(client.getQueryState("user_gc")).toBeUndefined();
    });
  });

  describe("Cache Garbage Collection and LRU Pruning", () => {
    it("should automatically schedule GC for unobserved queries (prefetched / hydrated)", () => {
      const client = new QueryClient({
        queries: { gcTime: 500 },
      });

      // Insert without any active listeners
      client.setQueryState("unobserved", { data: "cached_value" });
      expect(client.getQueryState("unobserved")?.data).toBe("cached_value");

      // Advance time by 499ms (not yet collected)
      vi.advanceTimersByTime(499);
      expect(client.getQueryState("unobserved")).toBeDefined();

      // Advance by 1ms more to reach 500ms
      vi.advanceTimersByTime(1);
      expect(client.getQueryState("unobserved")).toBeUndefined();
    });

    it("should cancel pending GC when a component subscribes to an unobserved query", () => {
      const client = new QueryClient({
        queries: { gcTime: 500 },
      });

      client.setQueryState("prefetch_key", { data: "fresh" });

      // Advance by 300ms
      vi.advanceTimersByTime(300);

      // Component mounts and subscribes!
      const unsub = client.subscribe("prefetch_key", () => {});

      // Advance by another 300ms (total 600ms > initial 500ms)
      vi.advanceTimersByTime(300);

      // Query is still safe in cache because component is subscribed
      expect(client.getQueryState("prefetch_key")?.data).toBe("fresh");

      // Now component unmounts
      unsub();

      // 500ms after unmount, it should be collected
      vi.advanceTimersByTime(499);
      expect(client.getQueryState("prefetch_key")).toBeDefined();
      vi.advanceTimersByTime(1);
      expect(client.getQueryState("prefetch_key")).toBeUndefined();
    });

    it("should enforce maxCacheSize by evicting oldest inactive queries in LRU order", () => {
      const client = new QueryClient({
        maxCacheSize: 3,
        queries: { gcTime: "10m" },
      });

      // Add 3 items with distinct timestamps
      client.setQueryState("item_1", { data: 1, updatedAt: 100 });
      client.setQueryState("item_2", { data: 2, updatedAt: 200 });
      client.setQueryState("item_3", { data: 3, updatedAt: 300 });

      expect(client.getCacheEntries().length).toBe(3);

      // Adding 4th item should prune oldest inactive item ("item_1")
      client.setQueryState("item_4", { data: 4, updatedAt: 400 });

      expect(client.getCacheEntries().length).toBe(3);
      expect(client.getQueryState("item_1")).toBeUndefined();
      expect(client.getQueryState("item_2")).toBeDefined();
      expect(client.getQueryState("item_3")).toBeDefined();
      expect(client.getQueryState("item_4")).toBeDefined();
    });

    it("should protect actively observed queries from maxCacheSize eviction", () => {
      const client = new QueryClient({
        maxCacheSize: 2,
        queries: { gcTime: "10m" },
      });

      // item_1 is older, BUT has an active subscriber
      client.setQueryState("active_item", { data: "active", updatedAt: 100 });
      const unsub = client.subscribe("active_item", () => {});

      // item_2 has NO subscriber
      client.setQueryState("inactive_item", { data: "inactive", updatedAt: 200 });

      // Adding 3rd item should evict inactive_item, NOT active_item
      client.setQueryState("new_item", { data: "new", updatedAt: 300 });

      expect(client.getQueryState("active_item")?.data).toBe("active");
      expect(client.getQueryState("inactive_item")).toBeUndefined();
      expect(client.getQueryState("new_item")?.data).toBe("new");

      unsub();
    });

    it("should remove queries by key, prefix, or filter predicate via removeQueries", () => {
      const client = new QueryClient();

      client.setQueryState("users|list", { data: [1, 2] });
      client.setQueryState("users|detail|1", { data: { id: 1 } });
      client.setQueryState("posts|list", { data: ["a", "b"] });

      // Remove prefix "users"
      client.removeQueries(["users"]);

      expect(client.getQueryState("users|list")).toBeUndefined();
      expect(client.getQueryState("users|detail|1")).toBeUndefined();
      expect(client.getQueryState("posts|list")).toBeDefined();

      // Remove by predicate
      client.removeQueries((entry) => entry.queryKey.startsWith("posts"));
      expect(client.getQueryState("posts|list")).toBeUndefined();
    });
  });
});

