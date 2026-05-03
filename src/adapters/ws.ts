/**
 * WebSocket adapter to attach an Actyx-RPC WebSocket procedure to a
 * standard WebSocket (like ws or native in Node.js).
 */
export function applyWSHandler<TPayload extends any = any>(options: {
  procedure: (...args: any[]) => (wsContext: any) => Promise<void>;
  ws: any; // e.g., a WebSocket instance from ws
  payload?: TPayload;
}) {
  const { procedure, ws, payload } = options;

  // 1. Prepare listeners and event handlers
  let messageCallback: ((data: any) => void) | undefined = undefined;
  let closeCallback: (() => void) | undefined = undefined;
  let errorCallback: ((err: any) => void) | undefined = undefined;

  // Setup the RPC connection to run your setup/middlewares
  const wsExecutor = procedure(payload);

  wsExecutor({
    send: (data: any) => {
      if (ws.readyState === 1) {
        // OPEN
        ws.send(typeof data === "object" ? JSON.stringify(data) : String(data));
      }
    },
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
