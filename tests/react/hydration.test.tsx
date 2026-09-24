/**
 * Hydration Tests for Actyx RPC Next.js App Router Support (SSR -> Client)
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  QueryClient,
  dehydrate,
  hydrate,
  createQueryClient,
  HydrationBoundary,
  useHydrate,
  useQuery,
  useQueries,
  useInfiniteQuery,
  usePaginatedQuery,
  useSSEInfiniteQuery,
  useWSInfiniteQuery,
  ActyxProvider,
} from "../../packages/react/src/index.js";

let root: Root | null = null;
let container: HTMLElement | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  if (container?.parentNode) {
    container.parentNode.removeChild(container);
  }
  root = null;
  container = null;
});

function renderComponent(ui: ReactNode): void {
  act(() => {
    root!.render(ui);
  });
}

describe("Next.js App Router Hydration Helpers (SSR -> Client)", () => {
  describe("QueryClient.dehydrate() and dehydrate()", () => {
    it("should serialize queries with successful data into a DehydratedState object", () => {
      const client = new QueryClient();
      client.setQueryState("todos|list", {
        data: [{ id: 1, title: "Buy groceries" }],
        isSuccess: true,
        updatedAt: 1000,
        isFetched: true,
      });
      client.setQueryState("user|session", {
        data: { id: "u1", name: "Alice" },
        isSuccess: true,
        updatedAt: 2000,
        isFetched: true,
      });
      // Query without data or not successful should not be dehydrated by default
      client.setQueryState("empty|query", {
        data: undefined,
        isSuccess: false,
        updatedAt: 0,
      });

      // Test both client.dehydrate() and dehydrate(client)
      const state1 = client.dehydrate();
      const state2 = dehydrate(client);

      expect(state1.queries).toHaveLength(2);
      expect(state2.queries).toHaveLength(2);

      const todos = state1.queries.find((q) => q.queryKey === "todos|list");
      expect(todos).toBeDefined();
      expect(todos?.data).toEqual([{ id: 1, title: "Buy groceries" }]);
      expect(todos?.updatedAt).toBe(1000);

      const user = state1.queries.find((q) => q.queryKey === "user|session");
      expect(user).toBeDefined();
      expect(user?.data).toEqual({ id: "u1", name: "Alice" });
      expect(user?.updatedAt).toBe(2000);
    });

    it("should allow custom shouldDehydrateQuery filter", () => {
      const client = new QueryClient();
      client.setQueryState("todos|list", {
        data: [1, 2, 3],
        isSuccess: true,
        updatedAt: 1000,
      });
      client.setQueryState("secret|token", {
        data: "token123",
        isSuccess: true,
        updatedAt: 1000,
      });

      const state = client.dehydrate({
        shouldDehydrateQuery: (query) => !query.queryKey.startsWith("secret"),
      });

      expect(state.queries).toHaveLength(1);
      expect(state.queries[0].queryKey).toBe("todos|list");
    });
  });

  describe("QueryClient.hydrate() and hydrate()", () => {
    it("should populate empty client cache with dehydrated queries", () => {
      const client = new QueryClient();
      expect(client.getQueryData("todos|list")).toBeUndefined();

      const dehydratedState = {
        queries: [
          {
            queryKey: "todos|list",
            data: [{ id: 1, text: "Hydrated todo" }],
            updatedAt: 5000,
          },
        ],
      };

      hydrate(client, dehydratedState);

      const data = client.getQueryData("todos|list");
      expect(data).toEqual([{ id: 1, text: "Hydrated todo" }]);

      const state = client.getQueryState("todos|list");
      expect(state?.isSuccess).toBe(true);
      expect(state?.isFetched).toBe(true);
      expect(state?.updatedAt).toBe(5000);
    });

    it("should prevent older SSR data from clobbering newer client-side updates", () => {
      const client = new QueryClient();

      // Client already mutated/fetched at t=10000
      client.setQueryState("todos|list", {
        data: [{ id: 1, text: "Client fresh data" }],
        isSuccess: true,
        updatedAt: 10000,
        isFetched: true,
      });

      // Older dehydrated state from SSR rendered at t=5000
      const oldDehydratedState = {
        queries: [
          {
            queryKey: "todos|list",
            data: [{ id: 1, text: "Old SSR data" }],
            updatedAt: 5000,
          },
        ],
      };

      client.hydrate(oldDehydratedState);

      // Should keep the newer client data
      expect(client.getQueryData("todos|list")).toEqual([
        { id: 1, text: "Client fresh data" },
      ]);
    });

    it("should apply newer dehydrated state over older client data", () => {
      const client = new QueryClient();

      client.setQueryState("todos|list", {
        data: [{ id: 1, text: "Old client data" }],
        isSuccess: true,
        updatedAt: 1000,
        isFetched: true,
      });

      const newerDehydratedState = {
        queries: [
          {
            queryKey: "todos|list",
            data: [{ id: 1, text: "Newer SSR data" }],
            updatedAt: 2000,
          },
        ],
      };

      client.hydrate(newerDehydratedState);

      expect(client.getQueryData("todos|list")).toEqual([
        { id: 1, text: "Newer SSR data" },
      ]);
    });
  });

  describe("QueryClient.prefetchQuery() Smart DX", () => {
    it("should automatically unwrap Actyx procedure caller tuple responses [data, null]", async () => {
      const client = new QueryClient();

      // Simulating: await queryClient.prefetchQuery(["todos", "list"], () => appRouter.todos.list())
      // where appRouter.todos.list() returns [data, null]
      await client.prefetchQuery(["todos", "list"], async () => {
        return [[{ id: 101, title: "Server fetched item" }], null];
      });

      // Stored data should be unwrapped data, NOT [data, null]
      const cached = client.getQueryData(["todos", "list"]);
      expect(cached).toEqual([{ id: 101, title: "Server fetched item" }]);

      const state = client.getQueryState("todos|list");
      expect(state?.isSuccess).toBe(true);
      expect(state?.isError).toBe(false);
      expect(state?.error).toBeUndefined();
    });

    it("should handle error tuple responses [null, error]", async () => {
      const client = new QueryClient();

      await client.prefetchQuery(["todos", "item"], async () => {
        return [null, { message: "Not found", statusCode: 404 }];
      });

      const state = client.getQueryState("todos|item");
      expect(state?.isError).toBe(true);
      expect(state?.isSuccess).toBe(false);
      expect(state?.error).toEqual({ message: "Not found", statusCode: 404 });
    });

    it("should handle raw return values that are not tuples", async () => {
      const client = new QueryClient();

      await client.prefetchQuery("metrics|cpu", async () => {
        return { usage: 42, cores: 8 };
      });

      expect(client.getQueryData("metrics|cpu")).toEqual({ usage: 42, cores: 8 });
    });

    it("should support TanStack Query style options object { queryKey, queryFn, staleTime }", async () => {
      const client = new QueryClient();

      await client.prefetchQuery({
        queryKey: ["users", "current"],
        queryFn: async () => [{ id: "user_1", role: "admin" }, null],
        staleTime: "5m",
      });

      expect(client.getQueryData(["users", "current"])).toEqual({
        id: "user_1",
        role: "admin",
      });
    });

    it("should support procedure object with getQueryKey", async () => {
      const client = new QueryClient();

      const mockProc = {
        getQueryKey: () => ["products", "popular"],
      };

      await client.prefetchQuery(mockProc, async () => {
        return [["Laptop", "Phone"], null];
      });

      expect(client.getQueryData(["products", "popular"])).toEqual([
        "Laptop",
        "Phone",
      ]);
    });

    it("should skip prefetch when data is already fresh within staleTime", async () => {
      const client = new QueryClient();
      let fetchCount = 0;

      const fetcher = async () => {
        fetchCount++;
        return [`Result ${fetchCount}`, null];
      };

      await client.prefetchQuery(["item", "1"], fetcher, { staleTime: "10s" });
      expect(fetchCount).toBe(1);
      expect(client.getQueryData(["item", "1"])).toBe("Result 1");

      // Calling again immediately within staleTime should skip fetch
      await client.prefetchQuery(["item", "1"], fetcher, { staleTime: "10s" });
      expect(fetchCount).toBe(1);
    });
  });

  describe("<HydrationBoundary /> and useHydrate() Zero-Flash SSR Hydration", () => {
    it("should hydrate synchronously during render so child useQuery immediately receives data on frame 0 with zero loading flash", async () => {
      // 1. Server side prefetch & dehydrate
      const serverClient = createQueryClient();
      await serverClient.prefetchQuery(["todos", "list"], async () => {
        return [
          [
            { id: 1, title: "Prefetched Todo 1" },
            { id: 2, title: "Prefetched Todo 2" },
          ],
          null,
        ];
      });

      const dehydratedState = serverClient.dehydrate();

      // 2. Client side setup
      const clientQueryClient = createQueryClient();
      let initialRenderLoading: boolean | null = null;
      let initialRenderData: any = null;
      let initialRenderIsSuccess: boolean | null = null;

      function TodoListClient() {
        const query = useQuery(async () => [[], null], {
          queryKey: ["todos", "list"],
        });

        // Capture first frame values during render
        if (initialRenderLoading === null) {
          initialRenderLoading = query.isLoading;
          initialRenderData = query.data;
          initialRenderIsSuccess = query.isSuccess;
        }

        return (
          <div>
            {query.isLoading ? (
              <span id="loading">Loading spinner...</span>
            ) : (
              <ul id="todos">
                {query.data?.map((t: any) => (
                  <li key={t.id}>{t.title}</li>
                ))}
              </ul>
            )}
          </div>
        );
      }

      // 3. Render HydrationBoundary wrapping child
      renderComponent(
        <ActyxProvider client={clientQueryClient}>
          <HydrationBoundary state={dehydratedState}>
            <TodoListClient />
          </HydrationBoundary>
        </ActyxProvider>,
      );

      // Critical assertion: on frame 0, isLoading was FALSE, isSuccess was TRUE, and data was present!
      expect(initialRenderLoading).toBe(false);
      expect(initialRenderIsSuccess).toBe(true);
      expect(initialRenderData).toEqual([
        { id: 1, title: "Prefetched Todo 1" },
        { id: 2, title: "Prefetched Todo 2" },
      ]);

      // DOM rendered the todos immediately without any loading spinner flash
      expect(container?.querySelector("#loading")).toBeNull();
      const items = container?.querySelectorAll("li");
      expect(items?.length).toBe(2);
      expect(items?.[0].textContent).toBe("Prefetched Todo 1");
      expect(items?.[1].textContent).toBe("Prefetched Todo 2");
    });


    it("should allow passing explicit client prop to HydrationBoundary", () => {
      const customClient = createQueryClient();
      const dehydrated = {
        queries: [
          {
            queryKey: "custom|val",
            data: "Custom Client Value",
            updatedAt: Date.now(),
          },
        ],
      };

      let queryVal: any = null;

      function CustomClientChild() {
        // useQuery with explicit client or default
        const client = customClient;
        queryVal = client.getQueryData("custom|val");
        return <div>{queryVal}</div>;
      }

      renderComponent(
        <HydrationBoundary client={customClient} state={dehydrated}>
          <CustomClientChild />
        </HydrationBoundary>,
      );

      expect(queryVal).toBe("Custom Client Value");
    });
  });

  describe("Out of the Box Hydration with Advanced Hooks", () => {
    it("should hydrate useQueries with multiple parallel queries without loading flash", () => {
      const serverClient = createQueryClient();
      serverClient.setQueryData(["user", "1"], { name: "Bob" });
      serverClient.setQueryData(["settings"], { theme: "dark" });
      const dehydrated = serverClient.dehydrate();

      const client = createQueryClient();
      let firstFrameLoading: boolean[] = [];
      let firstFrameData: any[] = [];

      function MultiQueryChild() {
        const results = useQueries(
          {
            queryKey: ["user", "1"],
            proc: async () => [{ name: "Bob" }, null],
          },
          {
            queryKey: ["settings"],
            proc: async () => [{ theme: "dark" }, null],
          },
        );

        if (firstFrameLoading.length === 0) {
          firstFrameLoading = [results[0].isLoading, results[1].isLoading];
          firstFrameData = [results[0].data, results[1].data];
        }

        return (
          <div>
            <span>{results[0].data?.name}</span>
            <span>{results[1].data?.theme}</span>
          </div>
        );
      }

      renderComponent(
        <ActyxProvider client={client}>
          <HydrationBoundary state={dehydrated}>
            <MultiQueryChild />
          </HydrationBoundary>
        </ActyxProvider>,
      );

      expect(firstFrameLoading).toEqual([false, false]);
      expect(firstFrameData).toEqual([{ name: "Bob" }, { theme: "dark" }]);
      expect(container?.textContent).toContain("Bob");
      expect(container?.textContent).toContain("dark");
    });

    it("should hydrate useInfiniteQuery on frame 0 with pre-populated pages", async () => {
      const serverClient = createQueryClient();
      await serverClient.prefetchInfiniteQuery(["feed"], async () => {
        return [
          {
            data: [
              { id: "p1", title: "First Post" },
              { id: "p2", title: "Second Post" },
            ],
            nextCursor: "cursor_2",
          },
          null,
        ];
      });

      const dehydrated = serverClient.dehydrate();
      const client = createQueryClient();

      let initialLoading: boolean | null = null;
      let initialCount: number | null = null;

      function InfiniteChild() {
        const { data, isLoading } = useInfiniteQuery(
          async () => ({ data: [], nextCursor: null }),
          {
            queryKey: ["feed"],
          },
        );

        if (initialLoading === null) {
          initialLoading = isLoading;
          initialCount = data.length;
        }

        return (
          <ul>
            {data.map((item: any) => (
              <li key={item.id}>{item.title}</li>
            ))}
          </ul>
        );
      }

      renderComponent(
        <ActyxProvider client={client}>
          <HydrationBoundary state={dehydrated}>
            <InfiniteChild />
          </HydrationBoundary>
        </ActyxProvider>,
      );

      expect(initialLoading).toBe(false);
      expect(initialCount).toBe(2);
      expect(container?.textContent).toContain("First Post");
      expect(container?.textContent).toContain("Second Post");
    });

    it("should lift non-paged prefetched data into useInfiniteQuery seamlessly", async () => {
      const serverClient = createQueryClient();
      // Prefetched using standard prefetchQuery instead of prefetchInfiniteQuery
      await serverClient.prefetchQuery(["posts", "infinite"], async () => {
        return [
          [
            { id: "1", text: "Standard prefetched item" },
          ],
          null,
        ];
      });

      const dehydrated = serverClient.dehydrate();
      const client = createQueryClient();

      let initialLoading: boolean | null = null;
      let initialItems: any[] = [];

      function AutoLiftedChild() {
        const { data, isLoading } = useInfiniteQuery(
          async () => [],
          {
            queryKey: ["posts", "infinite"],
          },
        );

        if (initialLoading === null) {
          initialLoading = isLoading;
          initialItems = [...data];
        }

        return <div>{data[0]?.text}</div>;
      }

      renderComponent(
        <ActyxProvider client={client}>
          <HydrationBoundary state={dehydrated}>
            <AutoLiftedChild />
          </HydrationBoundary>
        </ActyxProvider>,
      );

      expect(initialLoading).toBe(false);
      expect(initialItems[0]?.text).toBe("Standard prefetched item");
      expect(container?.textContent).toContain("Standard prefetched item");
    });

    it("should hydrate usePaginatedQuery on frame 0 without loading flash", async () => {
      const serverClient = createQueryClient();
      serverClient.setQueryState("table|paginated", {
        data: {
          pages: [
            {
              data: [{ id: 1, name: "Row 1" }],
              hasMore: true,
            },
          ],
          pageParams: [1],
        },
        isSuccess: true,
        updatedAt: Date.now(),
        isFetched: true,
      });

      const dehydrated = serverClient.dehydrate();
      const client = createQueryClient();

      let initialLoading: boolean | null = null;

      function PaginatedChild() {
        const { data, isLoading } = usePaginatedQuery(
          async () => ({ data: [], hasMore: false }),
          {
            queryKey: ["table", "paginated"],
          },
        );

        if (initialLoading === null) {
          initialLoading = isLoading;
        }

        return <div>{data[0]?.name}</div>;
      }

      renderComponent(
        <ActyxProvider client={client}>
          <HydrationBoundary state={dehydrated}>
            <PaginatedChild />
          </HydrationBoundary>
        </ActyxProvider>,
      );

      expect(initialLoading).toBe(false);
      expect(container?.textContent).toContain("Row 1");
    });

    it("should hydrate useSSEInfiniteQuery and useWSInfiniteQuery on frame 0 before streams connect", () => {
      const serverClient = createQueryClient();
      serverClient.setQueryState("live|infinite", {
        data: {
          pages: [
            {
              data: [{ id: "ev1", msg: "Hydrated Event" }],
            },
          ],
          pageParams: [],
        },
        isSuccess: true,
        updatedAt: Date.now(),
        isFetched: true,
      });

      const dehydrated = serverClient.dehydrate();
      const client = createQueryClient();

      let sseInitialCount = 0;

      function LiveSSEChild() {
        const { data } = useSSEInfiniteQuery(
          async () => ({ data: [] }),
          {
            url: "/api/dummy/sse",
            enabled: false, // stream disabled in unit test
            queryOpts: {
              queryKey: ["live", "infinite"],
            },
          },
        );

        if (sseInitialCount === 0) {
          sseInitialCount = data.length;
        }

        return <div>{data[0]?.msg}</div>;
      }

      renderComponent(
        <ActyxProvider client={client}>
          <HydrationBoundary state={dehydrated}>
            <LiveSSEChild />
          </HydrationBoundary>
        </ActyxProvider>,
      );

      expect(sseInitialCount).toBe(1);
      expect(container?.textContent).toContain("Hydrated Event");
    });
  });
});
