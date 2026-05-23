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
    queryClient.setQueryState("user_1", { data: { name: "Alice" }, isSuccess: true });
    
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

    queryClient.setQueryState("user_1", { data: { name: "Bob" } }, { silent: true });
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
      (old) => ({ ...old, role: "Admin" })
    );

    expect(oldData).toEqual({ name: "Carol" });
    expect(newData).toEqual({ name: "Carol", role: "Admin" });
    expect(queryClient.getQueryState("profile")?.data).toEqual({ name: "Carol", role: "Admin" });
  });

  it("should invalidate query keys and trigger invalidation listeners", () => {
    const listener = vi.fn();
    queryClient.onInvalidate("posts|list", listener);

    queryClient.setQueryState("posts|list", { data: ["post1"], updatedAt: Date.now() });
    
    // Invalidate prefix matches exact key
    queryClient.invalidateQueries(["posts", "list"]);

    const state = queryClient.getQueryState("posts|list");
    expect(state?.updatedAt).toBe(0); // Marked stale silently
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should invalidate query keys that start with invalidation prefix", () => {
    const listener = vi.fn();
    queryClient.onInvalidate("posts|list|page1", listener);

    queryClient.setQueryState("posts|list|page1", { data: ["post1"], updatedAt: Date.now() });
    
    // Invalidate prefix matches prefix of keys
    queryClient.invalidateQueries(["posts", "list"]);

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
});
