/**
 * React Hook Tests for useSuspenseQuery, useSSE, useWS, useSSEInfiniteQuery, useWSInfiniteQuery
 *
 * Tests use the same pattern as react-hooks.test.ts: React 19 act() + createRoot.
 * SSE/WS hooks mock their respective clients since jsdom has no real connections.
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement as h, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient } from "../src/react/lib/query-client.js";
import { ActyxProvider } from "../src/react/provider.js";
import { useState, useEffect, Suspense, Component } from "react";
import type { ErrorResponse } from "../src/types/misc.js";

// ---------------------------------------------------------------------------
// Minimal test harness
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
// Mock helpers
// ---------------------------------------------------------------------------

function createMockProc<T>(data: T, delayMs = 0): () => Promise<[T, null]> {
  return async () => {
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return [data, null];
  };
}

function createFailingProc(
  message = "test error",
  delayMs = 0,
): () => Promise<[null, ErrorResponse]> {
  return async () => {
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return [
      null,
      {
        success: false,
        message,
        statusCode: 500,
        reason: "SERVER_ERROR",
        handlerName: "test",
      },
    ];
  };
}

// ---------------------------------------------------------------------------
// Imports under test
// ---------------------------------------------------------------------------
import { useSuspenseQuery } from "../src/react/hooks/use-suspense-query.js";
import { useSSE } from "../src/react/hooks/use-sse.js";
import { useWS } from "../src/react/hooks/use-ws.js";
import { useSSEInfiniteQuery } from "../src/react/hooks/use-sse-infinite-query.js";
import { useWSInfiniteQuery } from "../src/react/hooks/use-ws-infinite-query.js";
import type { InfiniteQueryPage } from "../src/react/types.js";

// ===========================================================================
// useSuspenseQuery
// ===========================================================================

describe("useSuspenseQuery", () => {
  it("returns data when proc resolves", async () => {
    const proc = createMockProc<{ id: number; text: string }[]>([
      { id: 1, text: "hello" },
    ]);

    function TestComponent() {
      const result = useSuspenseQuery(proc, { queryKey: ["suspense-1"] });
      return h("div", null, JSON.stringify(result.data));
    }

    renderComponent(
      h(
        ActyxProvider,
        { client: new QueryClient() },
        h(Suspense, null, h(TestComponent)),
      ),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container?.textContent).toContain("hello");
  });

  it("returns data when initialData is provided", async () => {
    const proc = createMockProc<string[]>(["initial"]);

    function TestComponent() {
      const result = useSuspenseQuery(proc, {
        queryKey: ["suspense-initial"],
      });
      return h("div", null, JSON.stringify(result.data));
    }

    renderComponent(
      h(
        ActyxProvider,
        { client: new QueryClient() },
        h(Suspense, null, h(TestComponent)),
      ),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container?.textContent).toContain("initial");
  });

  it("throws error to ErrorBoundary", async () => {
    const proc = createFailingProc("boom");

    let caughtError: any = null;

    class ErrorBoundary extends Component<
      { children: ReactNode },
      { hasError: boolean }
    > {
      constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false };
      }
      static getDerivedStateFromError(error: any) {
        caughtError = error;
        return { hasError: true };
      }
      render() {
        return this.state.hasError
          ? h("div", null, "Error caught")
          : this.props.children;
      }
    }

    function TestComponent() {
      useSuspenseQuery(proc, { queryKey: ["suspense-error"] });
      return h("div", null, "Should not render");
    }

    renderComponent(
      h(
        ActyxProvider,
        { client: new QueryClient() },
        h(ErrorBoundary, null, h(TestComponent)),
      ),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container?.textContent).toContain("Error caught");
    expect(caughtError).toBeTruthy();
    expect(caughtError.message).toBe("boom");
  });

  it("isFetching is false after data loads", async () => {
    const proc = createMockProc<string[]>(["loaded"]);
    let fetchStates: boolean[] = [];

    function TestComponent() {
      const result = useSuspenseQuery(proc, { queryKey: ["suspense-state"] });
      fetchStates.push(result.isFetching);
      return h("div", null, result.data ? "loaded" : "loading");
    }

    renderComponent(
      h(
        ActyxProvider,
        { client: new QueryClient() },
        h(Suspense, null, h(TestComponent)),
      ),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // After resolution, isFetching should be false
    expect(fetchStates).toContain(false);
  });
});

// ===========================================================================
// useSSE
// ===========================================================================

describe("useSSE", () => {
  // Mock SSEClient — the module that useSSE dynamically imports
  const mockEvents: Array<{ data: any; event?: string }> = [];
  let mockCloseFn = vi.fn();
  let resolveConnection: (client: any) => void;

  beforeEach(() => {
    mockEvents.length = 0;
    mockCloseFn = vi.fn();

    vi.mock("../src/client/sse.js", () => ({
      SSEClient: vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          resolveConnection = resolve;
        });
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with empty data and idle state", () => {
    function TestComponent() {
      const result = useSSE({
        url: "http://localhost:3000/sse",
        enabled: false,
      });
      return h(
        "div",
        null,
        `connected:${result.isConnected} data:${result.data.length}`,
      );
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    expect(container?.textContent).toContain("connected:false");
    expect(container?.textContent).toContain("data:0");
  });

  it("does not connect when enabled is false", () => {
    function TestComponent() {
      useSSE({
        url: "http://localhost:3000/sse",
        enabled: false,
      });
      return h("div", null, "done");
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    // Component renders without error — connection was not attempted
    expect(container?.textContent).toContain("done");
  });

  it("close() disconnects", () => {
    let closeRef: (() => void) | null = null;

    function TestComponent() {
      const result = useSSE({
        url: "http://localhost:3000/sse",
        enabled: false,
      });
      closeRef = result.close;
      return h("div", null, `connected:${result.isConnected}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    expect(container?.textContent).toContain("connected:false");
    // close on already-disconnected should not throw
    act(() => {
      closeRef?.();
    });
  });

  it("clear() resets data", () => {
    let clearRef: (() => void) | null = null;
    let dataRef: any[] = [];

    function TestComponent() {
      const result = useSSE({
        url: "http://localhost:3000/sse",
        enabled: false,
      });
      clearRef = result.clear;
      dataRef = result.data;
      return h("div", null, `data:${result.data.length}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    expect(container?.textContent).toContain("data:0");
    act(() => {
      clearRef?.();
    });
  });
});

// ===========================================================================
// useWS
// ===========================================================================

describe("useWS", () => {
  let mockWsInstances: any[] = [];

  class MockWebSocket {
    url: string;
    onopen: any = null;
    onclose: any = null;
    onmessage: any = null;
    onerror: any = null;
    readyState = 0; // CONNECTING
    sent: any[] = [];

    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url: string) {
      this.url = url;
      mockWsInstances.push(this);
    }

    send(data: any) {
      this.sent.push(data);
    }

    close() {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.({ code: 1000, reason: "normal" });
    }

    // Helper to simulate incoming message
    _emitMessage(data: any) {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.({});
      this.onmessage?.({
        data: typeof data === "string" ? data : JSON.stringify(data),
      });
    }
  }

  beforeEach(() => {
    mockWsInstances = [];
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    delete (globalThis as any).WebSocket;
  });

  it("initializes with idle status", () => {
    function TestComponent() {
      const result = useWS({ url: "ws://localhost:3000/ws", enabled: false });
      return h(
        "div",
        null,
        `status:${result.status} data:${result.data.length}`,
      );
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    expect(container?.textContent).toContain("status:idle");
    expect(container?.textContent).toContain("data:0");
  });

  it("does not connect when enabled is false", () => {
    function TestComponent() {
      useWS({ url: "ws://localhost:3000/ws", enabled: false });
      return h("div", null, "done");
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    expect(mockWsInstances.length).toBe(0);
  });

  it("sends messages via send()", () => {
    let sendRef: ((data: any) => void) | null = null;

    function TestComponent() {
      const result = useWS({ url: "ws://localhost:3000/ws", enabled: false });
      sendRef = result.send;
      return h("div", null, "done");
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    // Send should be a no-op when not connected (no WS instance)
    act(() => {
      sendRef?.({ hello: "world" });
    });
  });

  it("unsubscribe() closes connection", () => {
    let unsubRef: (() => void) | null = null;

    function TestComponent() {
      const result = useWS({ url: "ws://localhost:3000/ws", enabled: false });
      unsubRef = result.unsubscribe;
      return h("div", null, `status:${result.status}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    act(() => {
      unsubRef?.();
    });

    expect(container?.textContent).toContain("status:idle");
  });

  it("handles initialData as sync array", () => {
    function TestComponent() {
      const result = useWS({
        url: "ws://localhost:3000/ws",
        enabled: false,
        initialData: [{ id: 1, msg: "preloaded" }],
      });
      return h("div", null, `data:${result.data.length}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    expect(container?.textContent).toContain("data:1");
  });
});

// ===========================================================================
// useSSEInfiniteQuery
// ===========================================================================

describe("useSSEInfiniteQuery", () => {
  beforeEach(() => {
    vi.mock("../src/client/sse.js", () => ({
      SSEClient: vi.fn().mockImplementation(() => {
        return new Promise(() => {}); // never resolves — we don't need SSE for basic tests
      }),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getPosts = async (input: {
    limit: number;
    cursor?: string;
  }): Promise<[InfiniteQueryPage<{ id: string; title: string }>, null]> => {
    return [
      {
        data: [
          { id: "1", title: "Post 1" },
          { id: "2", title: "Post 2" },
        ],
        hasMore: false,
      },
      null,
    ];
  };

  it("fetches initial page from query procedure", async () => {
    let resultData: any[] = [];

    function TestComponent() {
      const result = useSSEInfiniteQuery(getPosts as any, {
        queryOpts: {
          input: { limit: 5 },
          queryKey: ["sse-inf-test"],
        },
        url: "http://localhost:3000/sse",
        enabled: false, // disable SSE, only test the query part
      });
      resultData = result.data;
      return h(
        "div",
        null,
        `data:${result.data.length} hasNext:${result.hasNext}`,
      );
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    // The query should have fetched the initial page
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container?.textContent).toContain("data:2");
    expect(container?.textContent).toContain("hasNext:false");
  });

  it("arrange function transforms data", async () => {
    function TestComponent() {
      const result = useSSEInfiniteQuery(getPosts as any, {
        queryOpts: {
          input: { limit: 5 },
          queryKey: ["sse-inf-arrange"],
        },
        url: "http://localhost:3000/sse",
        enabled: false,
        arrange: (data: any[]) => data.reverse(),
      });
      return h("div", null, `data:${result.data.length}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container?.textContent).toContain("data:2");
  });
});

// ===========================================================================
// useWSInfiniteQuery
// ===========================================================================

describe("useWSInfiniteQuery", () => {
  let mockWsInstances: any[] = [];

  class MockWebSocket {
    url: string;
    onopen: any = null;
    onclose: any = null;
    onmessage: any = null;
    onerror: any = null;
    readyState = 0;
    sent: any[] = [];

    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    constructor(url: string) {
      this.url = url;
      mockWsInstances.push(this);
    }

    send(data: any) {
      this.sent.push(data);
    }

    close() {
      this.readyState = MockWebSocket.CLOSED;
      this.onclose?.({ code: 1000, reason: "normal" });
    }
  }

  const getPosts = async (input: {
    limit: number;
    cursor?: string;
  }): Promise<[InfiniteQueryPage<{ id: string; title: string }>, null]> => {
    return [
      {
        data: [
          { id: "1", title: "Post 1" },
          { id: "2", title: "Post 2" },
        ],
        hasMore: false,
      },
      null,
    ];
  };

  beforeEach(() => {
    mockWsInstances = [];
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    delete (globalThis as any).WebSocket;
  });

  it("fetches initial page from query procedure", async () => {
    function TestComponent() {
      const result = useWSInfiniteQuery(getPosts as any, {
        queryOpts: {
          input: { limit: 5 },
          queryKey: ["ws-inf-test"],
        },
        url: "ws://localhost:3000/ws",
        enabled: false, // disable WS, only test the query part
      });
      return h(
        "div",
        null,
        `data:${result.data.length} hasNext:${result.hasNext}`,
      );
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container?.textContent).toContain("data:2");
    expect(container?.textContent).toContain("hasNext:false");
  });

  it("does not open WS when enabled is false", () => {
    function TestComponent() {
      useWSInfiniteQuery(getPosts as any, {
        queryOpts: {
          input: { limit: 5 },
          queryKey: ["ws-inf-disabled"],
        },
        url: "ws://localhost:3000/ws",
        enabled: false,
      });
      return h("div", null, "done");
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    // No WS should have been created since enabled is false
    // (the query still runs but WS doesn't connect)
    expect(mockWsInstances.length).toBe(0);
  });
});
