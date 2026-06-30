import { MaybePromise } from "../../types/misc";

/** Socket that uses EventEmitter-style `.on()` (e.g. `ws` library). */
interface EventEmitterSocket {
  on: (event: string, listener: (...args: any[]) => void) => void;
  readyState: number;
  send: (data: string) => void;
}

/** Socket that uses DOM/WHATWG-style event properties (e.g. browser, Node.js built-in). */
interface DOMSocket {
  onmessage: ((ev: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: ((err: any) => void) | null;
  readyState: number;
  send: (data: string) => void;
}

/** Context object passed to the WebSocket procedure. */
export interface WSProcedureContext<TData = any> {
  send: (data: any) => void;
  broadcast: (data: TData) => void;
  onMessage: (cb: (data: any) => void) => void;
  onClose: (cb: () => void) => void;
  onError: (cb: (err: any) => void) => void;
}

/**
 * WebSocket adapter to attach an Actyx-RPC WebSocket procedure to a
 * standard WebSocket (like ws library, Node.js built-in, or browser).
 */
export function applyWSHandler<
  TData = any,
  WSClient extends EventEmitterSocket | DOMSocket = EventEmitterSocket,
>(
  /**
   * The Actyx-RPC procedure to attach to the WebSocket.
   * This procedure should be of type ".ws" and handle the WebSocket events.
   * It will receive a context object with send, broadcast, onMessage, onClose, and onError methods.
   */
  procedure: (wsContext: WSProcedureContext<TData>) => Promise<void>,
  options: {
    /**
     * The WebSocket instance to attach the procedure to.
     *
     * Supports `ws` library (EventEmitter `.on()`), Node.js built-in WebSocket, and browser WebSocket.
     */
    ws: WSClient;
    /**
     * Broadcast function to send a message to all connected clients.
     *
     * Typically: `(data) => wss.clients.forEach(client => client.send(...))`.
     */
    broadcast?: (data: TData) => void;
  },
) {
  const { ws } = options;

  // 1. Prepare listeners and event handlers
  let messageCallback: ((data: any) => void) | undefined = undefined;
  let closeCallback: (() => void) | undefined = undefined;
  let errorCallback: ((err: any) => void) | undefined = undefined;

  procedure({
    send: (data: any) => {
      if (ws.readyState === 1) {
        // OPEN
        ws.send(typeof data === "object" ? JSON.stringify(data) : String(data));
      }
    },
    broadcast: (data) => options.broadcast?.(data),
    onMessage: (cb: (data: any) => void) => {
      messageCallback = cb;
    },
    onClose: (cb: () => void) => {
      closeCallback = cb;
    },
    onError: (cb: (err: any) => void) => {
      errorCallback = cb;
    },
  });

  // 2. Attach event handlers — support both EventEmitter and DOM-style sockets
  const isEventEmitter = typeof (ws as any).on === "function";

  if (isEventEmitter) {
    const emitter = ws as unknown as EventEmitterSocket;

    emitter.on("message", (raw: any) => {
      if (!messageCallback) return;
      try {
        const parsed = JSON.parse(String(raw));
        messageCallback(parsed);
      } catch {
        messageCallback(String(raw));
      }
    });
    emitter.on("close", () => closeCallback?.());
    emitter.on("error", (err: any) => errorCallback?.(err));
  } else {
    const domSocket = ws as unknown as DOMSocket;

    domSocket.onmessage = (ev: { data: string }) => {
      if (!messageCallback) return;
      try {
        const parsed = JSON.parse(ev.data);
        messageCallback(parsed);
      } catch {
        messageCallback(ev.data);
      }
    };
    domSocket.onclose = () => closeCallback?.();
    domSocket.onerror = (err: any) => errorCallback?.(err);
  }
}
