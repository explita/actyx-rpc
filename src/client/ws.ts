export type WSClientOptions = {
  url: string;
  params?: Record<string, any>;
};

/**
 * Creates a type-safe WebSocket client for frontend and Node.js environments.
 */
export function WSClient<In = any, Out = any>(options: WSClientOptions) {
  const url = new URL(
    options.url,
    typeof window !== "undefined" ? window.location.origin : undefined,
  );

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      url.searchParams.set(key, String(value));
    }
  }

  // Handle auto-conversion of protocols for WS
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";

  if (!["ws:", "wss:"].includes(url.protocol)) {
    throw new Error("Invalid protocol for WebSocket");
  }

  const ws = new WebSocket(url.toString());

  return {
    send: (data: Out) => {
      if (ws.readyState === 1) {
        // OPEN
        ws.send(typeof data === "object" ? JSON.stringify(data) : String(data));
      }
    },
    onMessage: (cb: (data: In) => void) => {
      ws.onmessage = (event) => {
        try {
          cb(JSON.parse(event.data));
        } catch {
          cb(event.data);
        }
      };
    },
    onClose: (cb: () => void) => {
      ws.onclose = cb;
    },
    onError: (cb: (err: any) => void) => {
      ws.onerror = cb;
    },
    close: () => {
      ws.close();
    },
    ws, // Expose raw WebSocket instance
  };
}
