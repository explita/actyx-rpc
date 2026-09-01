/**
 * React Hook Tests for actyx-rpc
 *
 * Tests useQuery, useMutation, and useInfiniteQuery hooks using
 * React 19's act() + createRoot (no @testing-library/react needed).
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient } from "../src/react/lib/query-client.js";

// ---------------------------------------------------------------------------
// Minimal test harness: render a component, return the latest hook result
// ---------------------------------------------------------------------------

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeEach(() => {
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  container = null;
});

function renderComponent(ui: ReactNode): void {
  act(() => {
    root!.render(ui);
  });
}

function rerenderComponent(ui: ReactNode): void {
  act(() => {
    root!.render(ui);
  });
}

// ---------------------------------------------------------------------------
// Import hooks
// ---------------------------------------------------------------------------
import { useQuery } from "../src/react/hooks/use-query.js";
import { useMutation } from "../src/react/hooks/use-mutation.js";
import { useInfiniteQuery } from "../src/react/hooks/use-infinite-query.js";
import { useQueries } from "../src/react/hooks/use-queries.js";
import type { MutationResult } from "../src/types/misc.js";
import { ActyxProvider } from "../src/react/provider.js";
import { useState, createElement as h } from "react";
import type { ErrorResponse } from "../src/types/misc.js";

// ---------------------------------------------------------------------------
// Helper: create a mock proc (query function)
// ---------------------------------------------------------------------------
function createMockProc<T>(
  result: T,
  delay = 0,
): () => Promise<[T, null] | [null, ErrorResponse]> {
  return async () => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return [result, null];
  };
}

function createMockErrorProc(
  error: ErrorResponse,
  delay = 0,
): () => Promise<[null, ErrorResponse]> {
  return async () => {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    return [null, error];
  };
}

const mockError: ErrorResponse = {
  success: false,
  handlerName: "test",
  statusCode: 500,
  message: "Something went wrong",
  reason: "INTERNAL_ERROR",
};

// ---------------------------------------------------------------------------
// useQuery tests
// ---------------------------------------------------------------------------
describe("useQuery", () => {
  it("should return initial state before fetch completes", async () => {
    const proc = createMockProc({ name: "Alice" });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useQuery(proc, { queryKey: ["user"] });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    // After act(), effects have flushed so isFetching may be true.
    // The key assertion is that data hasn't been fetched yet.
    expect(result).toBeDefined();
    expect(result.isFetched).toBe(false);
  });

  it("should fetch data and update state on mount", async () => {
    const proc = createMockProc({ name: "Alice" });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useQuery(proc, { queryKey: ["user"] });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    // Wait for the fetch to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.data).toEqual({ name: "Alice" });
    expect(result.isSuccess).toBe(true);
    expect(result.isFetching).toBe(false);
    expect(result.isFetched).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should handle errors", async () => {
    const proc = createMockErrorProc(mockError);
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useQuery(proc, { queryKey: ["user"] });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.isError).toBe(true);
    expect(result.error).toEqual(mockError);
    expect(result.data).toBeUndefined();
  });

  it("should call onSuccess on successful fetch", async () => {
    const proc = createMockProc({ name: "Alice" });
    const onSuccess = vi.fn();
    const qc = new QueryClient();

    function TestComponent() {
      useQuery(proc, {
        queryKey: ["user"],
        onSuccess,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(onSuccess).toHaveBeenCalledWith({ name: "Alice" });
  });

  it("should call onError on failed fetch", async () => {
    const proc = createMockErrorProc(mockError);
    const onError = vi.fn();
    const qc = new QueryClient();

    function TestComponent() {
      useQuery(proc, {
        queryKey: ["user"],
        onError,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(onError).toHaveBeenCalledWith(mockError);
  });

  it("should support select transform", async () => {
    const proc = createMockProc({ name: "Alice", age: 30 });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useQuery(proc, {
        queryKey: ["user"],
        select: (data: any) => data.name,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.data).toBe("Alice");
  });

  it("should update raw cached data when select is used", async () => {
    const proc = createMockProc({ name: "Alice", age: 30 });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useQuery(proc, {
        queryKey: ["user"],
        select: (data: any) => data.name,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.data).toBe("Alice");

    // update writes the raw cached data (pre-select); select is re-applied on read
    act(() => {
      result.update({ name: "Bob", age: 30 });
    });
    expect(result.data).toBe("Bob");

    // updater receives the raw cached data
    act(() => {
      result.update((prev: any) => ({ ...prev, name: "Carol" }));
    });
    expect(result.data).toBe("Carol");
  });

  it("should update unwrapped cached data when unwrap is true", async () => {
    const proc = createMockProc({ success: true, data: { id: 1, name: "a" } });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useQuery(proc, {
        queryKey: ["user"],
        unwrap: true,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.data).toEqual({ id: 1, name: "a" });

    act(() => {
      result.update({ id: 1, name: "b" });
    });
    expect(result.data).toEqual({ id: 1, name: "b" });
  });

  it("should return initialData immediately", async () => {
    const proc = createMockProc({ name: "Bob" });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useQuery(proc, {
        queryKey: ["user"],
        initialData: { name: "Default" },
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    // initialData should be available before fetch
    expect(result.data).toEqual({ name: "Default" });
    expect(result.isSuccess).toBe(true);
    expect(result.isFetched).toBe(true);
  });

  it("should not fetch when enabled is false", async () => {
    const proc = createMockProc({ name: "Alice" });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useQuery(proc, {
        queryKey: ["user"],
        enabled: false,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.isFetching).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.isFetched).toBe(false);
  });

  it("should support refetch()", async () => {
    let callCount = 0;
    const proc = async (): Promise<[{ name: string }, null]> => {
      callCount++;
      return [{ name: `User ${callCount}` }, null];
    };
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useQuery(proc, { queryKey: ["user"] });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.data).toEqual({ name: "User 1" });

    await act(async () => {
      await result.refetch();
    });

    expect(result.data).toEqual({ name: "User 2" });
  });

  it("should support reset()", async () => {
    const proc = createMockProc({ name: "Alice" });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useQuery(proc, { queryKey: ["user"] });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.data).toEqual({ name: "Alice" });

    act(() => {
      result.reset();
    });

    expect(result.data).toBeUndefined();
    expect(result.isFetched).toBe(false);
  });

  it("should call onSettled after success", async () => {
    const proc = createMockProc({ name: "Alice" });
    const onSettled = vi.fn();
    const qc = new QueryClient();

    function TestComponent() {
      useQuery(proc, {
        queryKey: ["user"],
        onSettled,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(onSettled).toHaveBeenCalledTimes(1);
    // onSettled(data, error) — no third arg
    expect(onSettled).toHaveBeenCalledWith({ name: "Alice" }, null);
  });

  it("should call onSettled after error", async () => {
    const proc = createMockErrorProc(mockError);
    const onSettled = vi.fn();
    const qc = new QueryClient();

    function TestComponent() {
      useQuery(proc, {
        queryKey: ["user"],
        onSettled,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(onSettled).toHaveBeenCalledTimes(1);
    // onSettled(data, error) — no third arg
    expect(onSettled).toHaveBeenCalledWith(null, mockError);
  });

  it("should not re-fetch when staleTime has not elapsed", async () => {
    let callCount = 0;
    const proc = async (): Promise<[{ name: string }, null]> => {
      callCount++;
      return [{ name: `User ${callCount}` }, null];
    };
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useQuery(proc, {
        queryKey: ["user"],
        staleTime: 10000,
      });
      return null;
    }

    // First render + fetch
    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(callCount).toBe(1);

    // Re-render — should NOT re-fetch (data is fresh)
    rerenderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(callCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// useMutation tests
// ---------------------------------------------------------------------------
describe("useMutation", () => {
  it("should start in idle state", () => {
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useMutation(
        async (input: {
          name: string;
        }): Promise<MutationResult<{ id: number; name: string }>> => {
          return [{ id: 1, name: input.name }, null];
        },
        { mutationKey: ["createUser"] },
      );
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    expect(result.status).toBe("idle");
    expect(result.isPending).toBe(false);
    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it("should transition through pending → success", async () => {
    const qc = new QueryClient();
    let result: any = null;
    const onSuccess = vi.fn();

    function TestComponent() {
      result = useMutation(
        async (input: {
          name: string;
        }): Promise<MutationResult<{ id: number; name: string }>> => {
          return [{ id: 1, name: input.name }, null];
        },
        { mutationKey: ["createUser"], onSuccess },
      );
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    expect(result.status).toBe("idle");

    await act(async () => {
      await result.mutate({ name: "Alice" });
    });

    expect(result.status).toBe("success");
    expect(result.data).toEqual({ id: 1, name: "Alice" });
    expect(result.isPending).toBe(false);
    // onSuccess(data, context, ...args)
    expect(onSuccess).toHaveBeenCalledWith(
      { id: 1, name: "Alice" },
      undefined,
      { name: "Alice" },
    );
  });

  it("should transition to error state", async () => {
    const qc = new QueryClient();
    let result: any = null;
    const onError = vi.fn();

    function TestComponent() {
      result = useMutation(
        async () => {
          throw mockError;
        },
        { mutationKey: ["fail"], onError },
      );
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await result.mutate().catch(() => {});
    });

    expect(result.status).toBe("error");
    expect(result.error).toBeDefined();
    expect(onError).toHaveBeenCalled();
  });

  it("should reset state", async () => {
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useMutation(
        async (input: {
          name: string;
        }): Promise<MutationResult<{ id: number; name: string }>> => {
          return [{ id: 1, name: input.name }, null];
        },
        { mutationKey: ["createUser"] },
      );
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await result.mutate({ name: "Alice" });
    });

    expect(result.status).toBe("success");
    expect(result.data).toEqual({ id: 1, name: "Alice" });

    act(() => {
      result.reset();
    });

    expect(result.status).toBe("idle");
    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it("should call onSettled after success", async () => {
    const qc = new QueryClient();
    let result: any = null;
    const onSettled = vi.fn();

    function TestComponent() {
      result = useMutation(
        async (input: {
          name: string;
        }): Promise<MutationResult<{ id: number; name: string }>> => {
          return [{ id: 1, name: input.name }, null];
        },
        { mutationKey: ["createUser"], onSettled },
      );
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await result.mutate({ name: "Alice" });
    });

    expect(onSettled).toHaveBeenCalledTimes(1);
    // onSettled(data, error, context, ...args)
    expect(onSettled).toHaveBeenCalledWith(
      { id: 1, name: "Alice" },
      undefined,
      undefined,
      { name: "Alice" },
    );
  });

  it("should call onSettled after error", async () => {
    const qc = new QueryClient();
    let result: any = null;
    const onSettled = vi.fn();

    function TestComponent() {
      result = useMutation(
        async () => {
          throw mockError;
        },
        { mutationKey: ["fail"], onSettled },
      );
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await result.mutate().catch(() => {});
    });

    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// useInfiniteQuery tests
// ---------------------------------------------------------------------------
describe("useInfiniteQuery", () => {
  it("should return initial state before fetch", () => {
    const proc = createMockProc({
      data: ["item1"],
      nextCursor: "cursor1",
    });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useInfiniteQuery(proc, {
        queryKey: ["items"],
        input: {},
        getNextPageParam: (lastPage: any) => lastPage?.nextCursor,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    expect(result).toBeDefined();
    expect(result.data).toEqual([]);
    expect(result.pages).toEqual([]);
  });

  it("should fetch first page on mount", async () => {
    const proc = createMockProc({
      data: ["item1", "item2"],
      nextCursor: "cursor1",
    });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useInfiniteQuery(proc, {
        queryKey: ["items"],
        input: {},
        getNextPageParam: (lastPage: any) => lastPage?.nextCursor,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.data).toEqual(["item1", "item2"]);
    expect(result.pages).toHaveLength(1);
    expect(result.hasNext).toBe(true);
    expect(result.isSuccess).toBe(true);
  });

  it("should fetch next page", async () => {
    let pageCount = 0;
    const pages = [
      { data: ["item1"], nextCursor: "c1" },
      { data: ["item2"], nextCursor: "c2" },
      { data: ["item3"], nextCursor: undefined },
    ];
    const proc = async () => {
      const page = pages[pageCount] || pages[pages.length - 1];
      pageCount++;
      return [page, null] as const;
    };
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useInfiniteQuery(proc, {
        queryKey: ["items"],
        input: {},
        getNextPageParam: (lastPage: any) => lastPage?.nextCursor,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.data).toEqual(["item1"]);
    expect(result.hasNext).toBe(true);

    await act(async () => {
      await result.fetchNext();
    });

    expect(result.data).toEqual(["item1", "item2"]);
    expect(result.hasNext).toBe(true);

    await act(async () => {
      await result.fetchNext();
    });

    expect(result.data).toEqual(["item1", "item2", "item3"]);
    expect(result.hasNext).toBe(false);
  });

  it("should reset all pages", async () => {
    const proc = createMockProc({
      data: ["item1"],
      nextCursor: undefined,
    });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useInfiniteQuery(proc, {
        queryKey: ["items"],
        input: {},
        getNextPageParam: (lastPage: any) => lastPage?.nextCursor,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.data).toEqual(["item1"]);

    act(() => {
      result.reset();
    });

    expect(result.data).toEqual([]);
    expect(result.pages).toEqual([]);
    expect(result.isFetched).toBe(false);
  });

  it("should support arrange", async () => {
    const proc = createMockProc({
      data: ["banana", "apple", "cherry"],
      nextCursor: undefined,
    });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useInfiniteQuery(proc, {
        queryKey: ["items"],
        input: {},
        getNextPageParam: () => undefined,
        arrange: (items: string[]) => [...items].sort(),
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.data).toEqual(["apple", "banana", "cherry"]);
  });

  it("should call onSuccess on first fetch", async () => {
    const proc = createMockProc({
      data: ["item1"],
      nextCursor: undefined,
    });
    const onSuccess = vi.fn();
    const qc = new QueryClient();

    function TestComponent() {
      useInfiniteQuery(proc, {
        queryKey: ["items"],
        input: {},
        getNextPageParam: () => undefined,
        onSuccess,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it("should handle fetch errors", async () => {
    const proc = createMockErrorProc(mockError);
    const onError = vi.fn();
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useInfiniteQuery(proc, {
        queryKey: ["items"],
        input: {},
        getNextPageParam: () => undefined,
        onError,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.isError).toBe(true);
    expect(result.error).toEqual(mockError);
    expect(onError).toHaveBeenCalledWith(mockError);
  });

  it("should support selectItem", async () => {
    const proc = createMockProc({
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      nextCursor: undefined,
    });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useInfiniteQuery(proc, {
        queryKey: ["items"],
        input: {},
        getNextPageParam: () => undefined,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.selectedItem).toBeUndefined();

    act(() => {
      result.selectItem({ id: 2 });
    });

    expect(result.selectedItem).toEqual({ id: 2 });
  });

  it("should not fetch when enabled is false", async () => {
    const proc = createMockProc({
      data: ["item1"],
      nextCursor: undefined,
    });
    const qc = new QueryClient();
    let result: any = null;

    function TestComponent() {
      result = useInfiniteQuery(proc, {
        queryKey: ["items"],
        input: {},
        getNextPageParam: () => undefined,
        enabled: false,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.data).toEqual([]);
    expect(result.isFetching).toBe(false);
    expect(result.isFetched).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// useQueries tests
// ---------------------------------------------------------------------------
describe("useQueries", () => {
  it("should fetch multiple queries in parallel", async () => {
    const proc1 = createMockProc({ name: "Alice" });
    const proc2 = createMockProc({ name: "Bob" });
    const qc = new QueryClient();
    let results: any = null;

    function TestComponent() {
      results = useQueries(
        { proc: proc1, queryKey: ["user", 1] },
        { proc: proc2, queryKey: ["user", 2] },
      );
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(results).toHaveLength(2);
    expect(results[0].data).toEqual({ name: "Alice" });
    expect(results[1].data).toEqual({ name: "Bob" });
    expect(results[0].isSuccess).toBe(true);
    expect(results[1].isSuccess).toBe(true);
  });

  it("should handle mix of success and error queries", async () => {
    const proc1 = createMockProc({ name: "Alice" });
    const proc2 = createMockErrorProc({
      success: false,
      handlerName: "test",
      statusCode: 404,
      message: "Not found",
      reason: "NOT_FOUND",
    });
    const qc = new QueryClient();
    let results: any = null;

    function TestComponent() {
      results = useQueries(
        { proc: proc1, queryKey: ["user", 1] },
        { proc: proc2, queryKey: ["user", 2] },
      );
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(results[0].isSuccess).toBe(true);
    expect(results[0].data).toEqual({ name: "Alice" });
    expect(results[1].isError).toBe(true);
    expect(results[1].error?.message).toBe("Not found");
  });

  it("should support enabled=false to skip fetching", async () => {
    const proc = createMockProc({ name: "Alice" });
    const qc = new QueryClient();
    let results: any = null;

    function TestComponent() {
      results = useQueries({ proc, queryKey: ["user"], enabled: false });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(results[0].isFetched).toBe(false);
    expect(results[0].data).toBeUndefined();
  });

  it("should call onSuccess and onSettled for each query", async () => {
    const onSuccess1 = vi.fn();
    const onSuccess2 = vi.fn();
    const onSettled1 = vi.fn();
    const onSettled2 = vi.fn();
    const proc1 = createMockProc({ id: 1 });
    const proc2 = createMockProc({ id: 2 });
    const qc = new QueryClient();

    function TestComponent() {
      useQueries(
        {
          proc: proc1,
          queryKey: ["a"],
          onSuccess: onSuccess1,
          onSettled: onSettled1,
        },
        {
          proc: proc2,
          queryKey: ["b"],
          onSuccess: onSuccess2,
          onSettled: onSettled2,
        },
      );
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(onSuccess1).toHaveBeenCalledWith({ id: 1 });
    expect(onSuccess2).toHaveBeenCalledWith({ id: 2 });
    expect(onSettled1).toHaveBeenCalledWith({ id: 1 }, null);
    expect(onSettled2).toHaveBeenCalledWith({ id: 2 }, null);
  });

  it("should call onError and onSettled on error", async () => {
    const onError = vi.fn();
    const onSettled = vi.fn();
    const proc = createMockErrorProc({
      success: false,
      handlerName: "test",
      statusCode: 500,
      message: "fail",
      reason: "INTERNAL_ERROR",
    });
    const qc = new QueryClient();

    function TestComponent() {
      useQueries({ proc, queryKey: ["fail"], onError, onSettled });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(onError).toHaveBeenCalledOnce();
    expect(onSettled).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ message: "fail" }),
    );
  });

  it("should support refetch on each result", async () => {
    let callCount = 0;
    const proc = createMockProc({ count: () => ++callCount });
    const qc = new QueryClient();
    let results: any = null;
    let doRefetch: any = null;

    function TestComponent() {
      results = useQueries({ proc, queryKey: ["counter"] });
      doRefetch = results[0].refetch;
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(results[0].isSuccess).toBe(true);

    // Refetch
    await act(async () => {
      await doRefetch();
    });

    expect(results[0].isSuccess).toBe(true);
  });

  it("should support reset to clear state", async () => {
    const proc = createMockProc({ name: "Alice" });
    const qc = new QueryClient();
    let results: any = null;
    let doReset: any = null;

    function TestComponent() {
      results = useQueries({ proc, queryKey: ["user"] });
      doReset = results[0].reset;
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(results[0].isSuccess).toBe(true);
    expect(results[0].data).toEqual({ name: "Alice" });

    // Reset
    act(() => {
      doReset();
    });

    expect(results[0].data).toBeUndefined();
    expect(results[0].isFetched).toBe(false);
  });
});
