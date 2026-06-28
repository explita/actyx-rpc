import { SSEEvent } from "../types/misc.js";

export type SSEConnectionOptions = {
  url: string;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

/**
 * Connects to an SSE endpoint and yields typed events.
 * Handles the Server-Sent Events protocol parsing manually to support
 * standard fetch and better control than native EventSource.
 * Includes automatic reconnection on sleep/wake or connection drop.
 */
export async function SSEClient<T = any>(
  options: SSEConnectionOptions,
): Promise<AsyncIterable<SSEEvent<T>> & { close: () => void }> {
  let controller = new AbortController();
  let isClosed = false;

  if (options.signal) {
    if (options.signal.aborted) {
      isClosed = true;
    }
    options.signal.addEventListener("abort", () => {
      isClosed = true;
      controller.abort();
    });
  }

  const onOnline = () => {
    if (!isClosed) {
      console.warn("Browser came back online. Reconnecting SSE...");
      controller.abort();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", onOnline);
  }

  const iterable = {
    async *[Symbol.asyncIterator]() {
      let retryDelay = 3000;
      let lastEventId: string | undefined = undefined;

      while (!isClosed) {
        try {
          const url = new URL(
            options.url,
            typeof window !== "undefined" ? window.location.origin : undefined,
          );

          if (options.params) {
            for (const [key, value] of Object.entries(options.params)) {
              url.searchParams.set(key, String(value));
            }
          }
          if (lastEventId) {
            url.searchParams.set("lastEventId", lastEventId);
          }

          controller = new AbortController();
          const response = await fetch(url, {
            headers: {
              ...options.headers,
              Accept: "text/event-stream",
              "Cache-Control": "no-cache",
              // Connection: "keep-alive",
              ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
            },
            signal: controller.signal,
            credentials: "include",
            // keepalive: true,
          });

          if (!response.ok || !response.body) {
            throw new Error(`Failed to connect to SSE: ${response.statusText}`);
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          try {
            while (!isClosed) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n\n");
              buffer = lines.pop() || "";

              for (const block of lines) {
                const event: Partial<SSEEvent<any>> = {};
                let dataBuffer = "";

                for (const line of block.split("\n")) {
                  if (line.startsWith("data: ")) {
                    dataBuffer += (dataBuffer ? "\n" : "") + line.slice(6);
                  } else if (line.startsWith("event: ")) {
                    event.event = line.slice(7);
                  } else if (line.startsWith("id: ")) {
                    event.id = line.slice(4);
                    lastEventId = event.id;
                  } else if (line.startsWith("retry: ")) {
                    const parsedRetry = parseInt(line.slice(7), 10);
                    if (!isNaN(parsedRetry)) {
                      retryDelay = parsedRetry;
                    }
                  }
                }

                if (dataBuffer) {
                  try {
                    event.data = JSON.parse(dataBuffer);
                  } catch {
                    event.data = dataBuffer;
                  }
                  yield event as SSEEvent<T>;
                }
              }
            }
          } finally {
            controller.abort();
            reader.releaseLock();
          }
        } catch (error) {
          if (isClosed) break;
          // Small warning for debugging, but doesn't break the client app
          console.warn(
            `SSE disconnected. Reconnecting in ${retryDelay}ms...`,
            error,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    },
    close: () => {
      isClosed = true;
      controller.abort();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
      }
    },
  };

  return iterable;
}
