"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import type { ErrorResponse, FailureReason } from "../types/main.js";
import type { UseSSEOpts, UseSSEResult } from "../types/main.js";
import { SSEClient } from "../client/index.js";
import { actyxStreamTracker } from "../devtools/stream-tracker.js";

/**
 * React hook for consuming Server-Sent Events (SSE) from an Actyx RPC endpoint or URL.
 *
 * Automatically manages connection lifecycle, reconnection, event parsing, history buffering,
 * and streaming devtools tracking.
 *
 * @template T - The parsed SSE event data payload type.
 * @param options - Configuration options including `url`, `params`, `headers`, `maxHistory`, `onData`, and `onError`.
 * @returns A `UseSSEResult` object containing `data` (buffered history), `lastData`, `event`, `isConnected`, `close`, and `clear`.
 *
 * @example
 * ```tsx
 * const { lastData, isConnected, close } = useSSE<TickerData>({
 *   url: "/api/rpc/crypto.ticker",
 *   onData: (data) => console.log("New tick:", data),
 * });
 * ```
 */
export function useSSE<T = any>(options: UseSSEOpts<T>): UseSSEResult<T> {
  const {
    url,
    params,
    headers,
    signal,
    enabled = true,
    maxHistory = 100,
    onData,
    onError,
    arrange,
    retryDelay,
  } = options;

  const [data, setData] = useState<T[]>(() => {
    if (!options.initialData) return [];
    if (typeof options.initialData !== "function") {
      return options.initialData;
    }
    const result = options.initialData();
    if (!(result instanceof Promise)) {
      return result;
    }
    return [];
  });
  const [lastData, setLastData] = useState<T | undefined>();
  const [event, setEvent] = useState<string | undefined>();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<ErrorResponse | undefined>();

  const activeClientRef = useRef<{ close: () => void } | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const callbacksRef = useRef({
    onData,
    onError,
    arrange,
    filter: options.filter,
    dedupKey: options.dedupKey,
  });
  useEffect(() => {
    callbacksRef.current = {
      onData,
      onError,
      arrange,
      filter: options.filter,
      dedupKey: options.dedupKey,
    };
  });

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

    let streamId: string | null = null;

    const start = async () => {
      setIsConnected(true);
      setError(undefined);

      let client: Awaited<ReturnType<typeof SSEClient<T>>> | null = null;

      try {
        const parsedParams = paramsStr ? JSON.parse(paramsStr) : undefined;
        const parsedHeaders = headersStr ? JSON.parse(headersStr) : undefined;

        let displayUrl = url;
        if (parsedParams && Object.keys(parsedParams).length > 0) {
          const qs = new URLSearchParams(
            Object.entries(parsedParams).map(([k, v]) => [k, String(v)]),
          ).toString();
          displayUrl = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
        }
        streamId = actyxStreamTracker.registerStream("sse", displayUrl);

        client = await SSEClient<T>({
          url,
          params: parsedParams,
          headers: parsedHeaders,
          signal: localAbortController.signal,
          track: false,
          retryDelay,
        });

        if (isAborted) {
          client.close();
          if (streamId) {
            actyxStreamTracker.updateStatus(streamId, "disconnected");
            actyxStreamTracker.unregisterStream(streamId);
          }
          return;
        }

        activeClientRef.current = client;
        if (streamId) actyxStreamTracker.updateStatus(streamId, "connected");

        for await (const sseEvent of client) {
          if (isAborted) break;

          const raw: any = sseEvent.data;
          const isEnvelope =
            raw !== null &&
            typeof raw === "object" &&
            "type" in raw &&
            "data" in raw;

          const type: string =
            sseEvent.type || (isEnvelope ? raw.type : "message");
          const data: T = isEnvelope ? raw.data : raw;

          const event = {
            type,
            data,
            id: sseEvent.id,
            retry: sseEvent.retry,
          };

          if (type === "error") {
            const errPayload: any = data;
            const errResponse: ErrorResponse = {
              success: false,
              handlerName: "useSSE",
              statusCode: 500,
              message:
                typeof errPayload === "string"
                  ? errPayload
                  : errPayload?.message || "SSE Error",
              reason: errPayload?.reason || "UNEXPECTED_ERROR",
            };
            setError(errResponse);
            callbacksRef.current.onError?.(errResponse);
            continue;
          }

          setLastData(data);
          setEvent(type);

          if (streamId) {
            actyxStreamTracker.recordEvent(streamId, type, data);
          }

          const dedupKeyFn = callbacksRef.current.dedupKey;
          const filterFn = callbacksRef.current.filter;
          const prevData = dataRef.current;
          const existing = dedupKeyFn
            ? prevData.findIndex((i: any) => dedupKeyFn(i) === dedupKeyFn(data))
            : -1;
          const action = existing >= 0 ? "updated" : "added";

          if (filterFn ? filterFn(data) : true) {
            setData((prev) => {
              let next: T[];
              if (dedupKeyFn) {
                const key = dedupKeyFn(data);
                const idx = prev.findIndex(
                  (existing) => dedupKeyFn(existing) === key,
                );
                if (idx >= 0) {
                  next = [...prev];
                  next[idx] = data;
                } else {
                  next = [...prev, data];
                }
              } else {
                next = [...prev, data];
              }
              if (next.length > maxHistory) {
                return next.slice(-maxHistory);
              }
              return next;
            });
          }

          callbacksRef.current.onData?.(event, action);
        }
      } catch (err: any) {
        if (!isAborted && err.name !== "AbortError") {
          const statusCode = err.statusCode || 500;
          let reason: FailureReason = "UNEXPECTED_ERROR";
          if (statusCode === 401) reason = "UNAUTHORIZED";
          else if (statusCode === 403) reason = "FORBIDDEN";
          else if (statusCode === 404) reason = "NOT_FOUND";

          const errResponse: ErrorResponse = {
            success: false,
            handlerName: "useSSE",
            statusCode,
            message: err.message || "SSE connection error",
            reason,
          };
          setError(errResponse);
          if (streamId)
            actyxStreamTracker.updateStatus(streamId, "error", err.message);
          callbacksRef.current.onError?.(errResponse);
        }
      } finally {
        if (!isAborted) {
          setIsConnected(false);
          if (streamId)
            actyxStreamTracker.updateStatus(streamId, "disconnected");
        }
      }
    };

    start();

    return () => {
      isAborted = true;
      if (streamId) {
        actyxStreamTracker.updateStatus(streamId, "disconnected");
        actyxStreamTracker.unregisterStream(streamId);
      }
      localAbortController.abort();
      if (signal) {
        signal.removeEventListener("abort", onAbort);
      }

      // Also closes client even if ref wasn't assigned yet (race window)
      if (activeClientRef.current) {
        activeClientRef.current.close();
        activeClientRef.current = null;
      }
      setIsConnected(false);
    };
  }, [
    url,
    paramsStr,
    headersStr,
    enabled,
    signal,
    maxHistory,
    retryDelay,
    close,
  ]);

  const arrangedData = useMemo(() => {
    if (!callbacksRef.current.arrange) return data;
    return callbacksRef.current.arrange(data);
  }, [data]);

  return {
    data: arrangedData,
    lastData,
    event,
    isConnected,
    error,
    close,
    clear,
  };
}
