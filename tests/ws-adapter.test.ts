/**
 * Tests for the WebSocket adapter (applyWSHandler).
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyWSHandler } from "../src/adapters/ws/ws-handler.js";
import type { WSProcedureContext } from "../src/adapters/ws/ws-handler.js";
import { EventEmitter } from "events";

// ---------------------------------------------------------------------------
// Mock WebSocket (EventEmitter-style, like the `ws` library)
// ---------------------------------------------------------------------------

class MockEventEmitterWS extends EventEmitter {
  readyState = 1; // OPEN
  sentMessages: string[] = [];

  send = (data: string) => {
    this.sentMessages.push(data);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("applyWSHandler", () => {
  let ws: MockEventEmitterWS;

  beforeEach(() => {
    ws = new MockEventEmitterWS();
  });

  it("should invoke the procedure with a context", async () => {
    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      // Do nothing
    });

    applyWSHandler(procedureFn, { ws });

    expect(procedureFn).toHaveBeenCalledTimes(1);
    const ctx = procedureFn.mock.calls[0][0];
    expect(typeof ctx.send).toBe("function");
    expect(typeof ctx.broadcast).toBe("function");
    expect(typeof ctx.onMessage).toBe("function");
    expect(typeof ctx.onClose).toBe("function");
    expect(typeof ctx.onError).toBe("function");
  });

  it("should deliver parsed JSON messages to onMessage callback", async () => {
    let messageHandler: ((data: any) => void) | undefined;

    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      ctx.onMessage((data) => {
        messageHandler = data;
      });
    });

    applyWSHandler(procedureFn, { ws });

    // Simulate an incoming message
    ws.emit("message", JSON.stringify({ type: "ping" }));

    expect(messageHandler).toEqual({ type: "ping" });
  });

  it("should deliver raw string messages when JSON parsing fails", async () => {
    let messageHandler: ((data: any) => void) | undefined;

    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      ctx.onMessage((data) => {
        messageHandler = data;
      });
    });

    applyWSHandler(procedureFn, { ws });

    ws.emit("message", "not-json");

    expect(messageHandler).toBe("not-json");
  });

  it("should send JSON stringified data via send()", async () => {
    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      ctx.send({ type: "hello", data: 42 });
    });

    applyWSHandler(procedureFn, { ws });

    expect(ws.sentMessages).toHaveLength(1);
    expect(JSON.parse(ws.sentMessages[0])).toEqual({ type: "hello", data: 42 });
  });

  it("should send string data via send()", async () => {
    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      ctx.send("raw text");
    });

    applyWSHandler(procedureFn, { ws });

    expect(ws.sentMessages).toEqual(["raw text"]);
  });

  it("should not send if socket is not OPEN", async () => {
    ws.readyState = 3; // CLOSED

    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      ctx.send({ shouldNot: "arrive" });
    });

    applyWSHandler(procedureFn, { ws });

    expect(ws.sentMessages).toHaveLength(0);
  });

  it("should call broadcast via options.broadcast", async () => {
    const broadcastFn = vi.fn();

    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      ctx.broadcast({ event: "update" });
    });

    applyWSHandler(procedureFn, { ws, broadcast: broadcastFn });

    expect(broadcastFn).toHaveBeenCalledTimes(1);
    expect(broadcastFn).toHaveBeenCalledWith({ event: "update" });
  });

  it("should forward close events to onClose callback", async () => {
    let closeEvt: CloseEvent | undefined;

    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      ctx.onClose((evt) => {
        closeEvt = evt;
      });
    });

    applyWSHandler(procedureFn, { ws });

    ws.emit("close", 1000, Buffer.from("bye"));

    expect(closeEvt).toBeDefined();
    expect(closeEvt!.code).toBe(1000);
    expect(closeEvt!.reason).toBe("bye");
    expect(closeEvt!.wasClean).toBe(true);
  });

  it("should forward non-clean close events", async () => {
    let closeEvt: CloseEvent | undefined;

    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      ctx.onClose((evt) => {
        closeEvt = evt;
      });
    });

    applyWSHandler(procedureFn, { ws });

    ws.emit("close", 1006, Buffer.from("abnormal"));

    expect(closeEvt!.wasClean).toBe(false);
  });

  it("should forward error events to onError callback", async () => {
    let errorEvt: Event | undefined;

    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      ctx.onError((err) => {
        errorEvt = err;
      });
    });

    applyWSHandler(procedureFn, { ws });

    const mockError = new Error("connection failed");
    ws.emit("error", mockError);

    expect(errorEvt).toBe(mockError);
  });

  it("should not crash if onMessage is not registered", () => {
    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      // Don't register onMessage
    });

    applyWSHandler(procedureFn, { ws });

    // Should not throw
    expect(() => ws.emit("message", JSON.stringify({ data: 1 }))).not.toThrow();
  });

  it("should handle DOM-style WebSocket (onmessage/onclose/onerror)", async () => {
    const domWs = {
      readyState: 1,
      send: vi.fn(),
      onmessage: null as any,
      onclose: null as any,
      onerror: null as any,
    };

    let messageHandler: ((data: any) => void) | undefined;

    const procedureFn = vi.fn(async (ctx: WSProcedureContext) => {
      ctx.onMessage((data) => {
        messageHandler = data;
      });
    });

    applyWSHandler(procedureFn, { ws: domWs as any });

    // Simulate incoming DOM message event
    domWs.onmessage({ data: JSON.stringify({ test: true }) });
    expect(messageHandler).toEqual({ test: true });

    // Simulate close
    let closed = false;
    const procedureFn2 = vi.fn(async (ctx: WSProcedureContext) => {
      ctx.onClose(() => { closed = true; });
    });
    // Re-apply to test close
    const domWs2 = {
      readyState: 1,
      send: vi.fn(),
      onmessage: null as any,
      onclose: null as any,
      onerror: null as any,
    };
    applyWSHandler(procedureFn2, { ws: domWs2 as any });
    domWs2.onclose({ code: 1000, reason: "", wasClean: true });
    expect(closed).toBe(true);
  });
});
