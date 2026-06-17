import { useEffect, useState, useRef, useCallback } from "react";
import { SSEClient } from "../../client/sse.js";
import type { ErrorResponse } from "../../types/misc.js";
import type { UseSSEOptions, UseSSEReturn } from "../types.js";

export function useSSE<T = any>(options: UseSSEOptions<T>): UseSSEReturn<T> {
  const {
    url,
    params,
    headers,
    signal,
    enabled = true,
    maxHistory,
    onData,
    onError,
    arrange,
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [lastData, setLastData] = useState<T | undefined>();
  const [event, setEvent] = useState<string | undefined>();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<ErrorResponse | undefined>();

  const activeClientRef = useRef<{ close: () => void } | null>(null);

  const paramsStr = JSON.stringify(params);
  const headersStr = JSON.stringify(headers);

  const close = useCallback(() => {
    if (activeClientRef.current) {
      activeClientRef.current.close();
      activeClientRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const clear = useCallback(() => {
    setData([]);
    setLastData(undefined);
    setEvent(undefined);
  }, []);

  useEffect(() => {
    if (!enabled) {
      close();
      return;
    }

    let isAborted = false;
    const localAbortController = new AbortController();

    const onAbort = () => {
      isAborted = true;
      close();
    };

    if (signal) {
      if (signal.aborted) {
        return;
      }
      signal.addEventListener("abort", onAbort);
    }

    const start = async () => {
      setIsConnected(true);
      setError(undefined);

      try {
        const parsedParams = paramsStr ? JSON.parse(paramsStr) : undefined;
        const parsedHeaders = headersStr ? JSON.parse(headersStr) : undefined;

        const client = await SSEClient<T>({
          url,
          params: parsedParams,
          headers: parsedHeaders,
          signal: localAbortController.signal,
        });

        if (isAborted) {
          client.close();
          return;
        }

        activeClientRef.current = client;

        for await (const sseEvent of client) {
          if (isAborted) break;

          setLastData(sseEvent.data);
          setEvent(sseEvent.event);

          setData((prev) => {
            const next = [...prev, sseEvent.data];
            if (maxHistory !== undefined && next.length > maxHistory) {
              return arrange
                ? arrange(next.slice(-maxHistory))
                : next.slice(-maxHistory);
            }
            return arrange ? arrange(next) : next;
          });

          onData?.(sseEvent.data, sseEvent.event);
        }
      } catch (err: any) {
        if (!isAborted && err.name !== "AbortError") {
          const errResponse: ErrorResponse = {
            success: false,
            handlerName: "useSSE",
            statusCode: 500,
            message: err.message || "SSE connection error",
            reason: "UNEXPECTED_ERROR",
          };
          setError(errResponse);
          onError?.(errResponse);
        }
      } finally {
        if (!isAborted) {
          setIsConnected(false);
        }
      }
    };

    start();

    return () => {
      isAborted = true;
      localAbortController.abort();
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }
      close();
    };
  }, [
    url,
    paramsStr,
    headersStr,
    enabled,
    signal,
    maxHistory,
    close,
    onData,
    onError,
  ]);

  return {
    data,
    lastData,
    event,
    isConnected,
    error,
    close,
    clear,
  };
}
