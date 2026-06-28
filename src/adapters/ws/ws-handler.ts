/**
 * WebSocket adapter to attach an Actyx-RPC WebSocket procedure to a
 * standard WebSocket (like ws or native in Node.js).
 */
export function applyWSHandler<TData = any>(
  /**
   * The Actyx-RPC procedure to attach to the WebSocket.
   * This procedure should be of type ".ws" and handle the WebSocket events.
   * It will receive a context object with send, broadcast, onMessage, onClose, and onError methods.
   */
  procedure: (wsContext: any) => Promise<void>,
  options: {
    /**
     * The WebSocket instance to attach the procedure to.
     *
     * This can be a WebSocket from the `ws` library, or a native WebSocket in Node.js.
     */
    ws: any; // e.g., a WebSocket instance from ws
    /**
     * Broadcast function to send a message to all connected clients.
     *
     * Typically: `(data) => wss.clients.forEach(client => client.send(...))`.
     */
    broadcast: (data: TData) => void;
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
    broadcast: options.broadcast,
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

  // Attach event handlers to the actual underlying socket
  ws.on("message", (raw: any) => {
    if (!messageCallback) return;
    try {
      const parsed = JSON.parse(String(raw));
      messageCallback(parsed);
    } catch {
      messageCallback(String(raw));
    }
  });

  ws.on("close", () => {
    closeCallback?.();
  });

  ws.on("error", (err: any) => {
    errorCallback?.(err);
  });
}
