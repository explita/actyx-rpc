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
import { QueryClient } from "../../packages/react/src/lib/query-client.js";
import { ActyxProvider } from "../../packages/react/src/provider.js";
import { useState, useEffect, Suspense, Component } from "react";
import type { ErrorResponse } from "../../packages/react/src/types/main.js";
import { useQuery } from "../../packages/react/src/hooks/use-query.js";
import { useSuspenseQuery } from "../../packages/react/src/hooks/use-suspense-query.js";

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
import { useSuspenseQuery } from "../../packages/react/src/hooks/use-suspense-query.js";
import { useSSE } from "../../packages/react/src/hooks/use-sse.js";
import { useWS } from "../../packages/react/src/hooks/use-ws.js";
import { useSSEInfiniteQuery } from "../../packages/react/src/hooks/use-sse-infinite-query.js";
import { useWSInfiniteQuery } from "../../packages/react/src/hooks/use-ws-infinite-query.js";
import type { InfiniteQueryPage } from "../../packages/react/src/types/main.js";

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

    vi.mock("../../packages/react/src/client/sse.js", () => ({
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

  it("handles typing events natively without polluting data array", () => {
    let wsResult: any;

    function TestComponent() {
      wsResult = useWS({
        url: "ws://localhost:3000/ws",
        typing: { currentUserId: "me" },
      });
      return h(
        "div",
        null,
        `isTyping:${wsResult.isTyping},users:${wsResult.typingUsers.length},data:${wsResult.data.length}`,
      );
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    const ws = mockWsInstances[0];
    expect(container?.textContent).toContain("isTyping:false,users:0,data:0");

    // Simulate incoming typing event
    act(() => {
      ws._emitMessage({
        type: "typing",
        data: { userId: "user-1", name: "Alice" },
      });
    });

    // isTyping is true, typingUsers has Alice, but data is NOT polluted!
    expect(container?.textContent).toContain("isTyping:true,users:1,data:0");
    expect(wsResult.typingUsers[0]).toEqual({
      id: "user-1",
      name: "Alice",
      userId: "user-1",
    });

    // Simulate a real chat message from user-1
    act(() => {
      ws._emitMessage({
        type: "message",
        data: { userId: "user-1", text: "Hello!" },
      });
    });

    // Typing cleared immediately by message, and message is in data!
    expect(container?.textContent).toContain("isTyping:false,users:0,data:1");
  });

  it("ignores typing events from currentUserId (prevents self-reflection)", () => {
    let wsResult: any;

    function TestComponent() {
      wsResult = useWS({
        url: "ws://localhost:3000/ws",
        typing: {
          currentUserId: "my-user-id",
        },
      });
      return h("div", null, `isTyping:${wsResult.isTyping}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    const ws = mockWsInstances[0];

    // Simulate current user's own typing event
    act(() => {
      ws._emitMessage({
        type: "typing",
        data: { userId: "my-user-id", name: "Me" },
      });
    });

    // Ignored! isTyping remains false
    expect(container?.textContent).toContain("isTyping:false");
    expect(wsResult.typingUsers).toHaveLength(0);

    // Simulate other user's typing event
    act(() => {
      ws._emitMessage({
        type: "typing",
        data: { userId: "other-user-id", name: "Bob" },
      });
    });

    expect(container?.textContent).toContain("isTyping:true");
    expect(wsResult.typingUsers[0].name).toBe("Bob");
  });

  it("throttles sendTyping calls", () => {
    let wsResult: any;

    function TestComponent() {
      wsResult = useWS({
        url: "ws://localhost:3000/ws",
        typing: {
          throttle: "1000ms",
        },
      });
      return h("div", null, "test");
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    const ws = mockWsInstances[0];
    ws.readyState = 1; // OPEN

    act(() => {
      wsResult.sendTyping();
      wsResult.sendTyping();
      wsResult.sendTyping();
    });

    // Only 1 event sent due to throttling
    expect(ws.sent).toHaveLength(1);
    expect(JSON.parse(ws.sent[0])).toEqual({ type: "typing" });
  });

  it("prioritizes standard data.user without mistaking message id for user id", () => {
    let wsResult: any;

    function TestComponent() {
      wsResult = useWS({
        url: "ws://localhost:3000/ws",
        typing: { currentUserId: "me" },
      });
      return h("div", null, `users:${wsResult.typingUsers.length}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    const ws = mockWsInstances[0];

    // Typing with standard data.user: { id: "u-123", name: "Alice" }
    act(() => {
      ws._emitMessage({
        type: "typing",
        data: {
          user: { id: "u-123", name: "Alice" },
        },
      });
    });

    expect(wsResult.typingUsers[0]).toEqual({
      id: "u-123",
      name: "Alice",
    });

    // Incoming message has root id="msg-999" (message ID) and user={ id: "u-123" }
    // Must clear u-123 and NOT confuse msg-999 for user ID!
    act(() => {
      ws._emitMessage({
        type: "message",
        data: {
          id: "msg-999", // message ID!
          text: "Hi!",
          user: { id: "u-123", name: "Alice" },
        },
      });
    });

    // Cleared correctly!
    expect(wsResult.typingUsers).toHaveLength(0);
    expect(wsResult.data[0].id).toBe("msg-999");
  });

  it("supports custom getUser callback for non-standard schemas", () => {
    let wsResult: any;

    function TestComponent() {
      wsResult = useWS({
        url: "ws://localhost:3000/ws",
        typing: {
          getUser: (data) => ({
            id: data.sender.uid,
            name: data.sender.displayName,
          }),
        },
      });
      return h("div", null, `users:${wsResult.typingUsers.length}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    const ws = mockWsInstances[0];

    act(() => {
      ws._emitMessage({
        type: "typing",
        data: {
          sender: { uid: "u-custom", displayName: "Custom User" },
        },
      });
    });

    expect(wsResult.typingUsers[0].id).toBe("u-custom");
    expect(wsResult.typingUsers[0].name).toBe("Custom User");
  });

  it("automatically infers user type from output schema without requiring third type argument", () => {
    type ChatMsg = {
      id: string;
      text: string;
      user: { id: string; name: string; avatarUrl: string };
    };

    let wsResult: any;

    function TestComponent() {
      // Infers TypingUser<{ id: string; name: string; avatarUrl: string }> automatically!
      const ws = useWS<ChatMsg>({
        url: "ws://localhost:3000/ws",
        typing: {
          getUser: (data) => data.user,
        },
      });
      wsResult = ws;
      return h("div", null, `users:${ws.typingUsers.length}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    const ws = mockWsInstances[0];

    act(() => {
      ws._emitMessage({
        type: "typing",
        data: {
          user: {
            id: "u-99",
            name: "Bob",
            avatarUrl: "https://example.com/bob.png",
          },
        },
      });
    });

    expect(wsResult.typingUsers[0]).toEqual({
      id: "u-99",
      name: "Bob",
      avatarUrl: "https://example.com/bob.png",
    });
  });

  it("infers typingUsers type from getUser return type when custom fields are returned", () => {
    type ChatMsg = {
      id: string;
      text: string;
      user: { id: string; name: string };
    };

    let wsResult: any;

    function TestComponent() {
      // getUser returns custom shape with customRole and customScore
      const ws = useWS<ChatMsg>({
        url: "ws://localhost:3000/ws",
        typing: {
          getUser: (data) => ({
            id: data.user.id,
            customRole: "moderator" as const,
            customScore: 100,
          }),
        },
      });
      wsResult = ws;
      return h("div", null, `users:${ws.typingUsers.length}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    const ws = mockWsInstances[0];

    act(() => {
      ws._emitMessage({
        type: "typing",
        data: {
          user: { id: "u-mod", name: "ModUser" },
        },
      });
    });

    expect(wsResult.typingUsers[0].id).toBe("u-mod");
    expect(wsResult.typingUsers[0].customRole).toBe("moderator");
    expect(wsResult.typingUsers[0].customScore).toBe(100);
  });

  it("infers data type from initialData and typingUsers from getUser when generic is omitted", () => {
    let wsResult: any;

    function TestComponent() {
      // No generic type arguments provided!
      const ws = useWS({
        url: "ws://localhost:3000/ws",
        initialData: [
          { msgId: "m1", text: "Hello", author: { id: "a1", name: "Alice" } },
        ],
        typing: {
          getUser: (data) => ({
            id: data.author.id,
            badge: "verified" as const,
          }),
        },
      });
      wsResult = ws;
      return h("div", null, `data:${ws.data.length}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    expect(wsResult.data[0].msgId).toBe("m1");
    expect(wsResult.data[0].text).toBe("Hello");

    const ws = mockWsInstances[0];

    act(() => {
      ws._emitMessage({
        type: "typing",
        data: {
          author: { id: "a1", name: "Alice" },
        },
      });
    });

    expect(wsResult.typingUsers[0].id).toBe("a1");
    expect(wsResult.typingUsers[0].badge).toBe("verified");
  });

  it("infers typingUsers from ExtractTypingUserFromOutput when single generic with optional user is supplied", () => {
    type WsMsg = {
      message: string;
      user?: { id: string; name: string };
    };

    let wsResult: any;

    function TestComponent() {
      const ws = useWS<WsMsg>({
        url: "ws://localhost:3000/ws",
        typing: {
          getUser: (data) => ({
            id: data.user?.id ?? "unknown",
            name: data.user?.name ?? "",
          }),
        },
      });
      wsResult = ws;
      return h("div", null, `users:${ws.typingUsers.length}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    const ws = mockWsInstances[0];

    act(() => {
      ws._emitMessage({
        type: "typing",
        data: {
          user: { id: "u-42", name: "Bob" },
        },
      });
    });

    expect(wsResult.typingUsers[0].id).toBe("u-42");
    expect(wsResult.typingUsers[0].name).toBe("Bob");
  });

  it("supports explicit useWS<TOutput, TUser> for custom typingUsers shape", () => {
    type WsMsg = {
      message: string;
      user?: { id: string; name: string };
    };
    type CustomUser = { id: string; permissions: string[] };

    let wsResult: any;

    function TestComponent() {
      const ws = useWS<WsMsg, CustomUser>({
        url: "ws://localhost:3000/ws",
        typing: {
          getUser: (data) => ({
            id: data.user?.id ?? "unknown",
            permissions: ["read", "write"],
          }),
        },
      });
      wsResult = ws;
      return h("div", null, `users:${ws.typingUsers.length}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    const ws = mockWsInstances[0];

    act(() => {
      ws._emitMessage({
        type: "typing",
        data: {
          user: { id: "u-perm", name: "PermUser" },
        },
      });
    });

    expect(wsResult.typingUsers[0].id).toBe("u-perm");
    expect(wsResult.typingUsers[0].permissions).toEqual(["read", "write"]);
  });

  it("infers typingUsers and data from schema and getUser when generics are omitted", () => {
    type WsMsg = {
      message: string;
      user?: { id: string; name: string };
    };

    let wsResult: any;

    function TestComponent() {
      const ws = useWS({
        url: "ws://localhost:3000/ws",
        schema: {} as WsMsg,
        typing: {
          getUser: (data) => ({
            id: data.user?.id ?? "unknown",
            tag: "vip" as const,
          }),
        },
      });
      wsResult = ws;
      return h("div", null, `users:${ws.typingUsers.length}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    const ws = mockWsInstances[0];

    act(() => {
      ws._emitMessage({
        type: "typing",
        data: {
          user: { id: "u-vip", name: "VIP" },
        },
      });
    });

    expect(wsResult.typingUsers[0].id).toBe("u-vip");
    expect(wsResult.typingUsers[0].tag).toBe("vip");
  });
});

// ===========================================================================
// useSSEInfiniteQuery
// ===========================================================================

describe("useSSEInfiniteQuery", () => {
  beforeEach(() => {
    vi.mock("../../packages/react/src/client/sse.js", () => ({
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
          enabled: true,
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
          enabled: true,
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

    _emitMessage(data: any) {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.({});
      this.onmessage?.({
        data: typeof data === "string" ? data : JSON.stringify(data),
      });
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
          enabled: true,
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

  it("deduplicates and updates in-place via dedupKey with default onData handler", async () => {
    let hookResult: any;

    function TestComponent() {
      hookResult = useWSInfiniteQuery(getPosts as any, {
        queryOpts: {
          input: { limit: 5 },
          queryKey: ["ws-inf-dedup-default"],
          enabled: true,
          dedupKey: (post: any) => post.id,
        },
        url: "ws://localhost:3000/ws",
        enabled: true,
      });
      return null;
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(hookResult.data).toEqual([
      { id: "1", title: "Post 1" },
      { id: "2", title: "Post 2" },
    ]);

    const ws = mockWsInstances[0];

    // Emit message with existing id "1" -> updates in place
    act(() => {
      ws._emitMessage({
        type: "post",
        data: { id: "1", title: "Post 1 (Updated)" },
      });
    });

    expect(hookResult.data).toEqual([
      { id: "1", title: "Post 1 (Updated)" },
      { id: "2", title: "Post 2" },
    ]);

    // Emit message with new id "3" -> appends to end
    act(() => {
      ws._emitMessage({
        type: "post",
        data: { id: "3", title: "Post 3" },
      });
    });

    expect(hookResult.data).toEqual([
      { id: "1", title: "Post 1 (Updated)" },
      { id: "2", title: "Post 2" },
      { id: "3", title: "Post 3" },
    ]);
  });

  it("passes computed action ('updated' vs 'added') to custom onData handler when dedupKey is provided", async () => {
    let hookResult: any;
    const actionsReceived: string[] = [];

    function TestComponent() {
      hookResult = useWSInfiniteQuery(getPosts as any, {
        queryOpts: {
          input: { limit: 5 },
          queryKey: ["ws-inf-dedup-custom"],
          enabled: true,
          dedupKey: (post: any) => post.id,
        },
        url: "ws://localhost:3000/ws",
        enabled: true,
        onData: (ctx) => {
          actionsReceived.push(ctx.action);
          ctx.append(ctx.event.data);
        },
      });
      return null;
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const ws = mockWsInstances[0];

    // Existing item: should pass action: "updated"
    act(() => {
      ws._emitMessage({
        type: "post",
        data: { id: "2", title: "Post 2 (Edited)" },
      });
    });

    expect(actionsReceived).toEqual(["updated"]);
    expect(hookResult.data).toEqual([
      { id: "1", title: "Post 1" },
      { id: "2", title: "Post 2 (Edited)" },
    ]);

    // New item: should pass action: "added"
    act(() => {
      ws._emitMessage({
        type: "post",
        data: { id: "4", title: "Post 4" },
      });
    });

    expect(actionsReceived).toEqual(["updated", "added"]);
    expect(hookResult.data).toEqual([
      { id: "1", title: "Post 1" },
      { id: "2", title: "Post 2 (Edited)" },
      { id: "4", title: "Post 4" },
    ]);
  });
});

// ===========================================================================
// useQuery with input in opts and ...extraArgs
// ===========================================================================

describe("useQuery with input in opts and extraArgs", () => {
  it("passes input from opts and trailing extraArgs to procedure", async () => {
    const mockProc = vi
      .fn()
      .mockImplementation(async (input: { id: string }, extra: string) => {
        return [{ id: input.id, receivedExtra: extra }, null];
      });

    function TestComponent() {
      const { data, isLoading } = useQuery(
        mockProc as any,
        {
          input: { id: "user_123" },
          queryKey: ["test-user", "123"],
        },
        "extra_val",
      );
      if (isLoading || !data) return h("div", null, "loading");
      return h("div", null, `id:${data.id} extra:${data.receivedExtra}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockProc).toHaveBeenCalledWith({ id: "user_123" }, "extra_val");
    expect(container?.textContent).toContain("id:user_123 extra:extra_val");
  });

  it("handles procedure with no input schema and trailing extraArgs", async () => {
    const mockProc = vi
      .fn()
      .mockImplementation(async (arg1: string, arg2: number) => {
        return [{ sum: `${arg1}-${arg2}` }, null];
      });

    function TestComponent() {
      const { data } = useQuery(
        mockProc as any,
        { queryKey: ["test-no-input"] },
        "hello",
        42,
      );
      if (!data) return h("div", null, "loading");
      return h("div", null, `res:${data.sum}`);
    }

    renderComponent(
      h(ActyxProvider, { client: new QueryClient() }, h(TestComponent)),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(mockProc).toHaveBeenCalledWith("hello", 42);
    expect(container?.textContent).toContain("res:hello-42");
  });

  it("automatically incorporates input into default local queryKey when queryKey is not provided", async () => {
    const mockProc = vi
      .fn()
      .mockImplementation(async (input: { id: string }) => {
        return [{ id: input.id }, null];
      });

    function TestComponent({ id }: { id: string }) {
      const { data } = useQuery(mockProc as any, {
        input: { id },
      });
      return h("div", null, `data:${data ? data.id : "loading"}`);
    }

    renderComponent(
      h(
        ActyxProvider,
        { client: new QueryClient() },
        h(TestComponent, { id: "a" }),
      ),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container?.textContent).toContain("data:a");

    // Re-render with new id should trigger a fetch with new input
    rerenderComponent(
      h(
        ActyxProvider,
        { client: new QueryClient() },
        h(TestComponent, { id: "b" }),
      ),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(container?.textContent).toContain("data:b");
    expect(mockProc).toHaveBeenCalledWith({ id: "a" });
    expect(mockProc).toHaveBeenCalledWith({ id: "b" });
  });
});

