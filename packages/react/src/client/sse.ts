import { SSEEvent } from "../types/misc.js";
import { actyxStreamTracker } from "../devtools/stream-tracker.js";
import { WindowTime } from "../types/main.js";
import { parseWindow } from "../lib/utils.js";

export class SSEHttpError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "SSEHttpError";
    this.statusCode = statusCode;
  }
}

export type SSEConnectionOptions = {
  /**
   * Base URL for the SSE endpoint
   */
  url: string;
  /**
   * URL query parameters
   */
  params?: Record<string, any>;
  /**
   * Request headers
   */
  headers?: Record<string, string>;
  /**
   * Abort signal for the connection
   */
  signal?: AbortSignal;
  /**
   * Whether to register this connection in the Actyx DevTools stream tracker.
   * Set to false when already tracked by a higher-level hook like `useSSE`.
   * @default true
   */
  track?: boolean;
  /**
   * Retry delay in milliseconds when the connection is lost or the server returns an error.
   * Set to 0 to disable automatic reconnection.
   * @default 3000
   */
  retryDelay?: WindowTime;
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

  const shouldTrack = options.track !== false;
  let streamId: string | null = null;
  if (shouldTrack) {
    try {
      let displayUrl = options.url;
      if (options.params && Object.keys(options.params).length > 0) {
        const qs = new URLSearchParams(
          Object.entries(options.params).map(([k, v]) => [k, String(v)]),
        ).toString();
        displayUrl = `${options.url}${options.url.includes("?") ? "&" : "?"}${qs}`;
      }
      streamId = actyxStreamTracker.registerStream("sse", displayUrl);
      actyxStreamTracker.updateStatus(streamId, "connecting");
    } catch {
      // Optional tracking
    }
  }

  if (options.signal) {
    if (options.signal.aborted) {
      isClosed = true;
      if (streamId) {
        actyxStreamTracker.updateStatus(streamId, "disconnected");
        actyxStreamTracker.unregisterStream(streamId);
      }
    }
    options.signal.addEventListener(
      "abort",
      () => {
        isClosed = true;
        controller.abort();
        if (streamId) {
          actyxStreamTracker.updateStatus(streamId, "disconnected");
          actyxStreamTracker.unregisterStream(streamId);
        }
      },
      { once: true },
    );
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
      let retryDelay = parseWindow(options.retryDelay ?? 3000);
      let lastEventId: string | undefined = undefined;

      while (!isClosed) {
        if (options.signal?.aborted) {
          isClosed = true;
          break;
        }

        controller = new AbortController();
        const onSignalAbort = () => {
          isClosed = true;
          controller.abort();
        };
        if (options.signal) {
          options.signal.addEventListener("abort", onSignalAbort, {
            once: true,
          });
        }

        try {
          const url = new URL(
            options.url,
            typeof window !== "undefined" ? window.location.origin : undefined,
          );

          if (options.params) {
            for (const [key, value] of Object.entries(options.params)) {
              if (value !== undefined) {
                url.searchParams.set(key, String(value));
              }
            }
          }
          if (lastEventId) {
            url.searchParams.set("lastEventId", lastEventId);
          }

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
            if (streamId) {
              actyxStreamTracker.updateStatus(
                streamId,
                "error",
                response.statusText,
              );
            }
            if (
              response.status === 401 ||
              response.status === 403 ||
              response.status === 404
            ) {
              isClosed = true;
              throw new SSEHttpError(
                `SSE terminated with HTTP ${response.status} (${response.statusText}). Reconnection aborted.`,
                response.status,
              );
            }
            throw new Error(`Failed to connect to SSE: ${response.statusText}`);
          }

          if (streamId) {
            actyxStreamTracker.updateStatus(streamId, "connected");
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
                    const ev = line.slice(7);
                    event.type = ev;
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
                  let parsedData: any;
                  try {
                    parsedData = JSON.parse(dataBuffer);
                  } catch {
                    parsedData = dataBuffer;
                  }

                  // Detect if parsedData is already an event envelope: { type, data }
                  const isEnvelope =
                    parsedData !== null &&
                    typeof parsedData === "object" &&
                    "type" in parsedData &&
                    "data" in parsedData;

                  const type =
                    event.type ?? (isEnvelope ? parsedData.type : "message");
                  const data = isEnvelope ? parsedData.data : parsedData;

                  event.type = type;
                  event.data = data;

                  if (streamId) {
                    actyxStreamTracker.recordEvent(
                      streamId,
                      event.type,
                      event.data,
                    );
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
          if (streamId) {
            actyxStreamTracker.updateStatus(
              streamId,
              isClosed ? "disconnected" : "error",
              error instanceof Error ? error.message : String(error),
            );
          }
          if (isClosed || retryDelay <= 0) {
            if (error instanceof SSEHttpError) {
              throw error;
            }
            break;
          }
          // Small warning for debugging, but doesn't break the client app
          console.warn(
            `SSE disconnected. Reconnecting in ${retryDelay}ms...`,
            error,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        } finally {
          if (options.signal) {
            options.signal.removeEventListener("abort", onSignalAbort);
          }
        }
      }
    },
    close: () => {
      isClosed = true;
      controller.abort();
      if (streamId) {
        actyxStreamTracker.updateStatus(streamId, "disconnected");
        actyxStreamTracker.unregisterStream(streamId);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("online", onOnline);
      }
    },
  };

  return iterable;
}
