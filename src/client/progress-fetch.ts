export type ProgressOptions = {
  onProgress?: (progress: number) => void;
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

/**
 * A fetch wrapper that supports both upload and download progress.
 */
export async function progressFetch(
  url: string | URL,
  options: ProgressOptions = {},
): Promise<Response> {
  const { onProgress, method = "GET", body, headers = {}, signal } = options;

  // Use XMLHttpRequest for Upload progress (Mutations)
  if (method === "POST" || method === "PUT" || method === "PATCH") {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url);

      // Set headers
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Wire external abort signal to XHR
      let onAbort: (() => void) | undefined;
      if (signal) {
        if (signal.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        onAbort = () => {
          xhr.abort();
          reject(new DOMException("Aborted", "AbortError"));
        };
        signal.addEventListener("abort", onAbort, { once: true });
      }

      // Upload progress
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round(
              (event.loaded / event.total) * 100,
            );
            onProgress(percentComplete);
          }
        };
      }

      xhr.onload = () => {
        // Clean up abort listener to prevent leaks
        if (onAbort && signal) {
          signal.removeEventListener("abort", onAbort);
        }
        // Mock a Response-like object for compatibility
        const response = new Response(xhr.response, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: new Headers(
            xhr
              .getAllResponseHeaders()
              .trim()
              .split(/[\r\n]+/)
              .map((line) => {
                const parts = line.split(": ");
                return [parts.shift()!, parts.join(": ")] as [string, string];
              }),
          ),
        });
        resolve(response);
      };

      xhr.onerror = () => {
        if (onAbort && signal) {
          signal.removeEventListener("abort", onAbort);
        }
        reject(new DOMException("Network Error"));
      };
      xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
      xhr.send(body);
    });
  }

  // Use Fetch + ReadableStream for Download progress (Queries)
  const response = await fetch(url, options);
  if (!onProgress || !response.body) return response;

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (total === 0) return response;

  let loaded = 0;
  const reader = response.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        loaded += value.length;
        onProgress(Math.round((loaded / total) * 100));
        controller.enqueue(value);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}
