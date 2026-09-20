import type { SSEEvent } from "../../types/misc.js";
import { parseFrameworkError } from "../../lib/parse-framework-error.js";

/**
 * Transforms an AsyncIterable of SSEEvents into a web-standard ReadableStream
 * formatted for the Server-Sent Events protocol.
 */
export function createSSEResponse<TEventData = any>(
  iterator: AsyncIterable<SSEEvent<TEventData>>,
) {
  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of iterator) {
          if (isClosed) break;

          let chunk = "";

          if (event.id) chunk += `id: ${event.id}\n`;
          if (event.event) chunk += `event: ${event.event}\n`;
          if (event.retry) chunk += `retry: ${event.retry}\n`;

          // Handle multi-line data or objects
          const data =
            typeof event.data === "object"
              ? JSON.stringify(event.data)
              : String(event.data);

          chunk += `data: ${data}\n\n`;

          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            isClosed = true;
            break;
          }
        }
      } catch (error: any) {
        if (
          error?.name === "AbortError" ||
          error?.message?.includes("aborted") ||
          error?.message?.includes("closed")
        ) {
          return;
        }

        // Re-throw framework redirects (e.g. Next.js) so they propagate out of the catch block
        parseFrameworkError(error);

        console.error("SSE Stream Error:", error);
      } finally {
        if (!isClosed) {
          try {
            controller.close();
          } catch {
            // Stream was already closed/canceled by consumer — safe to ignore
          }
        }
      }
    },
    cancel() {
      isClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
