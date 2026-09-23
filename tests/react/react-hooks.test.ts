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
import { QueryClient } from "../../packages/react/src/lib/query-client.js";

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
import { useQuery } from "../../packages/react/src/hooks/use-query.js";
import { useMutation } from "../../packages/react/src/hooks/use-mutation.js";
import { useInfiniteQuery } from "../../packages/react/src/hooks/use-infinite-query.js";
import { useQueries } from "../../packages/react/src/hooks/use-queries.js";
import type { MutationResult } from "../../packages/react/src/types/main.js";
import { ActyxProvider } from "../../packages/react/src/provider.js";
import { createClient } from "../../packages/react/src/client/create-client.js";
import { useState, createElement as h } from "react";
import type { ErrorResponse } from "../../packages/react/src/types/main.js";

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

  it("should not refetch on mount if cache has fresh pages within staleTime", async () => {
    let callCount = 0;
    const proc = async () => {
      callCount++;
      return [{ data: [`item_${callCount}`], nextCursor: undefined }, null] as any;
    };
    const qc = new QueryClient();

    // Pre-populate cache with fresh data
    qc.setQueryState("items", {
      data: { pages: [{ data: ["cached_item"], nextCursor: undefined }], pageParams: [undefined] },
      isSuccess: true,
      updatedAt: Date.now(),
      isFetched: true,
    });

    let result: any = null;
    function TestComponent() {
      result = useInfiniteQuery(proc, {
        queryKey: ["items"],
        input: {},
        staleTime: 60000,
        getNextPageParam: () => undefined,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Should NOT have called proc because cache is fresh
    expect(callCount).toBe(0);
    expect(result.data).toEqual(["cached_item"]);
  });

  it("should not refetch on mount if refetchOnMount is false", async () => {
    let callCount = 0;
    const proc = async () => {
      callCount++;
      return [{ data: [`item_${callCount}`], nextCursor: undefined }, null] as any;
    };
    const qc = new QueryClient();

    // Pre-populate cache with data that is older than staleTime
    qc.setQueryState("items_refetch", {
      data: { pages: [{ data: ["stale_item"], nextCursor: undefined }], pageParams: [undefined] },
      isSuccess: true,
      updatedAt: Date.now() - 10000,
      isFetched: true,
    });

    let result: any = null;
    function TestComponent() {
      result = useInfiniteQuery(proc, {
        queryKey: ["items_refetch"],
        input: {},
        staleTime: 0,
        refetchOnMount: false,
        getNextPageParam: () => undefined,
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Should NOT have called proc because refetchOnMount is false
    expect(callCount).toBe(0);
    expect(result.data).toEqual(["stale_item"]);
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

describe("QueryClient Default / Global Options in Hooks", () => {
  it("useQuery should inherit global enabled: false from defaultOptions", async () => {
    let callCount = 0;
    const proc = vi.fn(async () => {
      callCount++;
      return [{ name: "Alice" }, null];
    });

    const qc = new QueryClient({
      queries: {
        enabled: false,
      },
    });

    let hookResult: any = null;
    function TestComponent() {
      hookResult = useQuery(proc, { queryKey: ["user"] });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Should not have fetched because enabled: false was defaulted globally
    expect(callCount).toBe(0);
    expect(hookResult.data).toBeUndefined();
    expect(hookResult.isFetching).toBe(false);
  });

  it("useQuery hook-level options should override global defaultOptions", async () => {
    let callCount = 0;
    const proc = vi.fn(async () => {
      callCount++;
      return [{ name: "Alice" }, null];
    });

    const qc = new QueryClient({
      queries: {
        enabled: false,
      },
    });

    let hookResult: any = null;
    function TestComponent() {
      hookResult = useQuery(proc, { queryKey: ["user"], enabled: true });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Hook level enabled: true should override global enabled: false
    expect(callCount).toBe(1);
    expect(hookResult.data).toEqual({ name: "Alice" });
  });

  it("useQuery should trigger global onSuccess callback from defaultOptions", async () => {
    const globalOnSuccess = vi.fn();
    const localOnSuccess = vi.fn();

    const proc = vi.fn(async () => [{ name: "Alice" }, null]);

    const qc = new QueryClient({
      queries: {
        onSuccess: globalOnSuccess,
      },
    });

    function TestComponent() {
      useQuery(proc, { queryKey: ["user"], onSuccess: localOnSuccess });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(localOnSuccess).toHaveBeenCalledWith({ name: "Alice" });
    expect(globalOnSuccess).toHaveBeenCalledWith({ name: "Alice" });
  });

  it("useQuery should respect key-specific defaults configured via setQueryDefaults", async () => {
    let usersCalled = false;
    let postsCalled = false;

    const usersProc = vi.fn(async () => {
      usersCalled = true;
      return [["u1"], null];
    });
    const postsProc = vi.fn(async () => {
      postsCalled = true;
      return [["p1"], null];
    });

    const qc = new QueryClient();
    // Disable users queries specifically
    qc.setQueryDefaults(["users"], { enabled: false });

    function TestComponent() {
      useQuery(usersProc, { queryKey: ["users", "list"] });
      useQuery(postsProc, { queryKey: ["posts", "list"] });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(usersCalled).toBe(false);
    expect(postsCalled).toBe(true);
  });

  it("useMutation should trigger global onSuccess from defaultOptions", async () => {
    const globalSuccess = vi.fn();
    const localSuccess = vi.fn();

    const mutationAction = async (input: { name: string }): Promise<MutationResult<{ id: number; name: string }>> => {
      return [{ id: 1, name: input.name }, null];
    };

    const qc = new QueryClient({
      mutations: {
        onSuccess: globalSuccess,
      },
    });

    let mutationResult: any = null;
    function TestComponent() {
      mutationResult = useMutation(mutationAction, { onSuccess: localSuccess });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await mutationResult.mutate({ name: "New Item" });
    });

    expect(localSuccess).toHaveBeenCalledWith(
      { id: 1, name: "New Item" },
      undefined,
      { name: "New Item" },
    );
    expect(globalSuccess).toHaveBeenCalledWith(
      { id: 1, name: "New Item" },
      undefined,
      { name: "New Item" },
    );
  });
});

describe("Client Proxy Hooks with nested input in opts & extra args", () => {
  const routerMock = {
    users: {
      get: Object.assign(
        async (input: { id: string }, prefix = "User:") => {
          return [{ id: input.id, name: `${prefix} ${input.id}` }, null];
        },
        {
          _def: {
            type: "query",
            input: {} as { id: string },
            output: {} as { id: string; name: string },
            args: [] as [prefix?: string],
          },
        },
      ),
      list: Object.assign(
        async (category = "all") => {
          return [{ category, items: ["Alice", "Bob"] }, null];
        },
        {
          _def: {
            type: "query",
            input: undefined,
            output: {} as { category: string; items: string[] },
            args: [] as [category?: string],
          },
        },
      ),
      infinite: Object.assign(
        async (input: { cursor?: number; limit?: number }) => {
          const cursor = input?.cursor ?? 0;
          return [
            {
              data: [`user-${cursor}`, `user-${cursor + 1}`],
              nextCursor: cursor + 2,
              hasMore: cursor < 4,
            },
            null,
          ];
        },
        {
          _def: {
            type: "query",
            input: {} as { cursor?: number; limit?: number },
            output: {} as {
              data: string[];
              nextCursor: number;
              hasMore: boolean;
            },
            args: [] as [],
          },
        },
      ),
      create: Object.assign(
        async (input: { name: string }, role = "member") => {
          return [{ id: "u-1", name: input.name, role }, null];
        },
        {
          _def: {
            type: "mutation",
            input: {} as { name: string },
            output: {} as { id: string; name: string; role: string },
            args: [] as [role?: string],
          },
        },
      ),
    },
  };

  const client = createClient<typeof routerMock>({
    baseUrl: "http://localhost/api/rpc",
    fetch: async (url, init) => {
      const parsed = new URL(url.toString());
      const proc = parsed.pathname.replace(/^\/api\/rpc\//, "");
      const [seg, method] = proc.split(".");
      const fn = (routerMock as any)[seg]?.[method];
      if (!fn) return new Response("Not found", { status: 404 });
      let input: any;
      let args: any[] = [];
      if (init?.body) {
        const parsedBody = JSON.parse(init.body as string);
        input = parsedBody.input;
        args = parsedBody.args || [];
      } else {
        const inputParam = parsed.searchParams.get("input");
        if (inputParam) input = JSON.parse(inputParam);
        const argsParam = parsed.searchParams.get("args");
        if (argsParam) args = JSON.parse(argsParam);
      }
      const [data, err] =
        input !== undefined ? await fn(input, ...args) : await fn(...args);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  it("should support useQuery with { input, ...opts } and extra args", async () => {
    let hookResult: any = null;
    function TestComponent() {
      hookResult = client.users.get.useQuery(
        { input: { id: "42" }, unwrap: false },
        "Member:",
      );
      return null;
    }

    renderComponent(h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(hookResult.data).toEqual({ id: "42", name: "Member: 42" });
  });

  it("should support useQuery without input and with extra args", async () => {
    let hookResult: any = null;
    function TestComponent() {
      hookResult = client.users.list.useQuery({}, "admins");
      return null;
    }

    renderComponent(h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(hookResult.data).toEqual({ category: "admins", items: ["Alice", "Bob"] });
  });

  it("should support useMutation with extra args forwarded to mutate", async () => {
    let mutationResult: any = null;
    function TestComponent() {
      mutationResult = client.users.create.useMutation();
      return null;
    }

    renderComponent(h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)));

    let mutateRes: any = null;
    await act(async () => {
      mutateRes = await mutationResult.mutate({ name: "Charlie" }, "admin");
    });

    expect(mutateRes).toEqual([{ id: "u-1", name: "Charlie", role: "admin" }, null]);
    expect(mutationResult.data).toEqual({ id: "u-1", name: "Charlie", role: "admin" });
  });

  it("should scope custom queryKey array under procedure path in useQuery and invalidate", async () => {
    const qc = new QueryClient();
    let hookResult: any = null;
    let renderCount = 0;

    function TestComponent() {
      renderCount++;
      // Custom queryKey containing only userId: ['user-123']
      hookResult = client.users.list.useQuery({
        queryKey: ["user-123"],
      }, "admins");
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(hookResult.data).toEqual({ category: "admins", items: ["Alice", "Bob"] });

    // Cache should contain the scoped key: ['users', 'list', 'user-123']
    const cachedState = qc.getQueryState("users|list|user-123");
    expect(cachedState).toBeDefined();
    expect(cachedState?.data).toEqual({ category: "admins", items: ["Alice", "Bob"] });

    const countBeforeInvalidate = renderCount;

    // Invalidate with scoped array [user-123]
    await act(async () => {
      client.users.list.invalidate(["user-123"]);
    });

    // Should have triggered a refetch on that query
    expect(renderCount).toBeGreaterThan(countBeforeInvalidate);
  });

  it("should only allow useInfiniteQuery on paginated procedures", async () => {
    // 1. Unpaginated procedure: users.get has useInfiniteQuery typed as undefined
    // @ts-expect-error users.get is unpaginated so useInfiniteQuery is undefined
    const unpaginatedFn = client.users.get.useInfiniteQuery;
    expect(unpaginatedFn).toBeDefined(); // proxy intercepts at runtime, but TS flags as undefined

    // 2. Paginated procedure: users.infinite has useInfiniteQuery available and fully typed
    const qc = new QueryClient();
    let infiniteResult: any = null;

    function TestComponent() {
      infiniteResult = client.users.infinite.useInfiniteQuery({
        input: { limit: 2 },
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: qc }, h(TestComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(infiniteResult.data).toEqual(["user-0", "user-1"]);
    expect(infiniteResult.hasNext).toBe(true);

    // Fetch next page
    await act(async () => {
      await infiniteResult.fetchNext();
    });

    expect(infiniteResult.data).toEqual(["user-0", "user-1", "user-2", "user-3"]);
  });
});

describe("Client normalization for Axios and custom HTTP methods", () => {
  it("should seamlessly support axios-like client returning { data, status } without response.ok and without response.json", async () => {
    const mockAxios = vi.fn().mockImplementation(async (url: string, config: any) => {
      expect(config.method).toBe("GET");
      return {
        data: { message: "Axios success", count: 42 },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    });

    const client = createClient<any>({
      baseUrl: "http://localhost/api/rpc",
      fetch: mockAxios,
    });

    const [data, err] = await client.stats.get.query({ timeframe: "today" });
    expect(err).toBeNull();
    expect(data).toEqual({ message: "Axios success", count: 42 });
    expect(mockAxios).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost/api/rpc/stats.get?input="),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("should extract error payload and status when axios-like client throws AxiosError with error.response", async () => {
    const mockAxios = vi.fn().mockImplementation(async (url: string, config: any) => {
      const axiosError: any = new Error("Request failed with status code 400");
      axiosError.isAxiosError = true;
      axiosError.response = {
        data: {
          success: false,
          message: "Validation failed",
          reason: "VALIDATION_ERROR",
          statusCode: 400,
          handlerName: "users.create",
        },
        status: 400,
        statusText: "Bad Request",
      };
      throw axiosError;
    });

    const client = createClient<any>({
      baseUrl: "http://localhost/api/rpc",
      fetch: mockAxios,
    });

    const [data, err] = await client.users.create.mutate({ name: "" });
    expect(data).toBeNull();
    expect(err).toEqual({
      success: false,
      message: "Validation failed",
      reason: "VALIDATION_ERROR",
      statusCode: 400,
      handlerName: "users.create",
    });
  });

  it("should allow overriding HTTP method to POST, PATCH, PUT, DELETE in useQuery and useMutation", async () => {
    const recordedRequests: Array<{ method: string; url: string; body?: any; data?: any }> = [];

    const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      recordedRequests.push({
        method: init.method,
        url,
        body: init.body,
        data: init.data,
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = createClient<any>({
      baseUrl: "http://localhost/api/rpc",
      fetch: mockFetch,
    });

    // useQuery with method: "POST"
    let queryResult: any = null;
    function QueryComponent() {
      queryResult = client.search.useQuery({
        input: { q: "actyx" },
        method: "POST",
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: new QueryClient() }, h(QueryComponent)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });

    expect(recordedRequests[0].method).toBe("POST");
    expect(recordedRequests[0].body).toBe(JSON.stringify({ input: { q: "actyx" } }));

    // useMutation with method: "DELETE"
    let mutationResult: any = null;
    function MutationComponent() {
      mutationResult = client.users.delete.useMutation({
        method: "DELETE",
      });
      return null;
    }

    renderComponent(h(ActyxProvider, { client: new QueryClient() }, h(MutationComponent)));

    await act(async () => {
      await mutationResult.mutate({ id: "123" });
    });

    expect(recordedRequests[1].method).toBe("DELETE");
    expect(recordedRequests[1].body).toBe(JSON.stringify({ input: { id: "123" } }));

    // Direct .mutate with method: "PATCH"
    await client.users.update.mutate({ id: "123", name: "Alice" }, { method: "PATCH" });
    expect(recordedRequests[2].method).toBe("PATCH");
    expect(recordedRequests[2].body).toBe(JSON.stringify({ input: { id: "123", name: "Alice" } }));
  });

  it("should throw an error if baseUrl is missing in createClient options", () => {
    expect(() => createClient<any>({} as any)).toThrow(
      "createClient requires 'baseUrl' in options (e.g. createClient({ baseUrl: '/api/rpc' }))",
    );
    expect(() => (createClient as any)()).toThrow(
      "createClient requires 'baseUrl' in options (e.g. createClient({ baseUrl: '/api/rpc' }))",
    );
  });

  it("should support { input, ...opts } and primitive input inside opts in useQuery", async () => {
    let capturedQuery: { url: string; method: string } | null = null;
    const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      capturedQuery = { url, method: init.method };
      return new Response(JSON.stringify({ id: "user-42", name: "Alice" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = createClient<any>({
      baseUrl: "/api/rpc", // Test relative baseUrl without crashing
      fetch: mockFetch,
    });

    // 1. Object input inside opts: useQuery({ input: { id: "user-42" } })
    let result1: any = null;
    function Comp1() {
      result1 = client.users.get.useQuery({ input: { id: "user-42" } });
      return null;
    }
    renderComponent(h(ActyxProvider, { client: new QueryClient() }, h(Comp1)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(capturedQuery?.url).toContain("input=%7B%22id%22%3A%22user-42%22%7D");
    expect(result1.data).toEqual({ id: "user-42", name: "Alice" });

    // 2. Primitive input inside opts: useQuery({ input: "user-42" })
    let result2: any = null;
    function Comp2() {
      result2 = client.users.get.useQuery({ input: "user-42" });
      return null;
    }
    renderComponent(h(ActyxProvider, { client: new QueryClient() }, h(Comp2)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(capturedQuery?.url).toContain("input=%22user-42%22");
    expect(result2.data).toEqual({ id: "user-42", name: "Alice" });

    // 3. Input with options inside opts: useQuery({ input: { id: "user-42" }, enabled: false })
    let result3: any = null;
    function Comp3() {
      result3 = client.users.get.useQuery({ input: { id: "user-42" }, enabled: false });
      return null;
    }
    renderComponent(h(ActyxProvider, { client: new QueryClient() }, h(Comp3)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Should not fetch because enabled is false
    expect(result3.isFetching).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("should support catch and finally on callable proxy promise", async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = createClient<any>({
      baseUrl: "http://localhost/api/rpc",
      fetch: mockFetch,
    });

    let finallyCalled = false;
    const res = await client.ping()
      .catch((err: any) => err)
      .finally(() => {
        finallyCalled = true;
      });

    expect(finallyCalled).toBe(true);
    expect(res).toEqual([{ ok: true }, null]);
  });

  it("should support usePaginatedQuery with bi-directional pagination on client proxy", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      const urlObj = new URL(url, "http://localhost");
      const inputStr = urlObj.searchParams.get("input");
      let cursor = 0;
      if (inputStr) {
        try {
          const parsed = JSON.parse(inputStr);
          cursor = Number(parsed?.pageParam ?? parsed?.cursor ?? 0);
        } catch {}
      }
      return new Response(
        JSON.stringify({
          data: [`item-${cursor}`, `item-${cursor + 1}`],
          hasMore: cursor < 4,
          nextCursor: cursor + 2,
          previousCursor: cursor > 0 ? cursor - 2 : undefined,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const client = createClient<any>({
      baseUrl: "http://localhost/api/rpc",
      fetch: mockFetch,
    });

    let hookResult: any = null;
    function Comp() {
      hookResult = client.todos.list.usePaginatedQuery({
        getNextPageParam: (lastPage: any) => lastPage?.nextCursor,
        getPreviousPageParam: (firstPage: any) => firstPage?.previousCursor,
      });
      return null;
    }
    renderComponent(h(ActyxProvider, { client: new QueryClient() }, h(Comp)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(hookResult.data).toEqual(["item-0", "item-1"]);
    expect(hookResult.hasNext).toBe(true);
    expect(typeof hookResult.fetchPrevious).toBe("function");
  });

  it("should provide array mutation helpers (append, prepend, insert, remove) on useQuery when data is an array", async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify(["item-1", "item-2"]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const client = createClient<any>({
      baseUrl: "http://localhost/api/rpc",
      fetch: mockFetch,
    });

    let hookResult: any = null;
    function Comp() {
      hookResult = client.todos.list.useQuery({ queryKey: ["todos"] });
      return null;
    }
    renderComponent(h(ActyxProvider, { client: new QueryClient() }, h(Comp)));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(hookResult.data).toEqual(["item-1", "item-2"]);
    expect(typeof hookResult.prepend).toBe("function");
    expect(typeof hookResult.append).toBe("function");
    expect(typeof hookResult.insert).toBe("function");
    expect(typeof hookResult.remove).toBe("function");

    // Prepend
    await act(async () => {
      hookResult.prepend("item-0");
    });
    expect(hookResult.data).toEqual(["item-0", "item-1", "item-2"]);

    // Append
    await act(async () => {
      hookResult.append("item-3");
    });
    expect(hookResult.data).toEqual(["item-0", "item-1", "item-2", "item-3"]);

    // Insert at index 2
    await act(async () => {
      hookResult.insert(2, "item-1.5");
    });
    expect(hookResult.data).toEqual(["item-0", "item-1", "item-1.5", "item-2", "item-3"]);

    // Remove by predicate
    await act(async () => {
      hookResult.remove((item: string) => item === "item-1.5");
    });
    expect(hookResult.data).toEqual(["item-0", "item-1", "item-2", "item-3"]);

    // Rollback test
    let rollbackFn: () => void = () => {};
    await act(async () => {
      rollbackFn = hookResult.prepend("item-temp");
    });
    expect(hookResult.data).toEqual(["item-temp", "item-0", "item-1", "item-2", "item-3"]);

    await act(async () => {
      rollbackFn();
    });
    expect(hookResult.data).toEqual(["item-0", "item-1", "item-2", "item-3"]);

    // Targeted update by predicate
    let updateRollback: () => void = () => {};
    await act(async () => {
      updateRollback = hookResult.update(
        (item: string) => item === "item-1",
        (item: string) => `${item}-updated`,
      );
    });
    expect(hookResult.data).toEqual(["item-0", "item-1-updated", "item-2", "item-3"]);

    // Targeted update rollback
    await act(async () => {
      updateRollback();
    });
    expect(hookResult.data).toEqual(["item-0", "item-1", "item-2", "item-3"]);

    // Targeted update by index
    await act(async () => {
      hookResult.update(2, "item-2-replaced");
    });
    expect(hookResult.data).toEqual(["item-0", "item-1", "item-2-replaced", "item-3"]);

    // Whole-array update (1-arg) still works as before
    await act(async () => {
      hookResult.update(["a", "b"]);
    });
    expect(hookResult.data).toEqual(["a", "b"]);
  });

  it("should support proxy procedure helpers: getQueryKey, getQueryData, setQueryData, reset, isFetching, isMutating", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ data: ["todo 1", "todo 2"], success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const client = createClient<any>({
      baseUrl: "http://localhost/api/rpc",
      fetch: mockFetch,
    });

    // 1. getQueryKey & getMutationKey
    expect(client.todos.list.getQueryKey()).toEqual(["todos", "list"]);
    expect(client.todos.byId.getQueryKey({ id: "123" })).toEqual(["todos", "byId", { id: "123" }]);
    expect(client.todos.add.getMutationKey()).toEqual(["todos", "add"]);
    expect(client.todos.add.getQueryKey()).toEqual(["todos", "add"]);

    // 2. getQueryData / setQueryData / reset
    expect(client.todos.list.getQueryData()).toBeUndefined();
    client.todos.list.setQueryData(["custom-1", "custom-2"]);
    expect(client.todos.list.getQueryData()).toEqual(["custom-1", "custom-2"]);

    client.todos.list.setQueryData((old: string[] | undefined) => [...(old ?? []), "custom-3"]);
    expect(client.todos.list.getQueryData()).toEqual(["custom-1", "custom-2", "custom-3"]);

    client.todos.list.reset();
    expect(client.todos.list.getQueryData()).toBeUndefined();

    // 3. isFetching / isMutating
    expect(client.todos.list.isFetching()).toBe(false);
    expect(client.todos.add.isMutating()).toBe(false);
  });

  it("should support direct calling and .useSSE() on streaming proxy procedures", async () => {
    const client = createClient<any>({
      baseUrl: "http://localhost/api/rpc",
    });

    // 1. Direct call returns an object with Symbol.asyncIterator, close, and then
    const stream = client.notifications({ channel: "alerts" });
    expect(typeof stream[Symbol.asyncIterator]).toBe("function");
    expect(typeof stream.close).toBe("function");
    expect(typeof stream.then).toBe("function");

    // 2. .useSSE exists as a hook function
    expect(typeof client.notifications.useSSE).toBe("function");
  });

  it("should support useSSEInfiniteQuery with stream procedure or url", async () => {
    const client = createClient<any>({
      baseUrl: "http://localhost/api/rpc",
    });

    expect(typeof client.todos.list.useSSEInfiniteQuery).toBe("function");
    expect(typeof client.todos.list.useWSInfiniteQuery).toBe("function");
  });
});




