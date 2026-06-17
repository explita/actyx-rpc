import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient } from "../src/react/lib/query-client.js";

describe("React: QueryClient Caching & Invalidation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.useFakeTimers();
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
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
        expect(queryClient.getQueryState("arr")?.data).toEqual(["a", "b", "c"]);
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
});
