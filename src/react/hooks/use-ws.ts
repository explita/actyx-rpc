"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorResponse, MaybePromise } from "../../types/misc.js";
import type { UseWSOpts, UseWSResult } from "../types.js";

/**
 * Hook for connecting to a WebSocket server and receiving real-time messages.
 *
 * @param opts Options for the connection, including the WebSocket URL.
 */
export function useWS<
  TInitialData = undefined,
  TOutput = TInitialData extends undefined ? any : TInitialData,
>(opts: UseWSOpts<TOutput>): UseWSResult<TOutput> {
  const [data, setData] = useState<TOutput[]>(() => {
    if (!opts.initialData) return [];
    if (typeof opts.initialData !== "function") {
      return opts.initialData as TOutput[];
    }
    const result = opts.initialData();
    if (!(result instanceof Promise)) {
      return result as TOutput[];
    }
    // Async function — start empty, resolve in effect below
    return [];
  });
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [error, setError] = useState<ErrorResponse | undefined>();
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const sendRef = useRef<(data: any) => void>(() => {});
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Resolve async initialData — must be in an effect, not in useState initializer.
  // Reads from optsRef to avoid re-running on every render when initialData is an inline function.
  useEffect(() => {
    const initData = optsRef.current.initialData;
    if (!initData || optsRef.current.enabled === false) return;
    if (typeof initData !== "function") return;
    const result = initData();
    if (!(result instanceof Promise)) return;

    let cancelled = false;
    setIsFetchingInitialData(true);
    result
      .then((resolved) => {
        if (cancelled) return;
        setData(resolved as TOutput[]);
      })
      .finally(() => {
        setIsFetchingInitialData(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isClosedRef = useRef(false);

  const unsubscribe = useCallback(() => {
    isClosedRef.current = true;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("idle");
    optsRef.current.onUnsubscribed?.();
  }, []);

  useEffect(() => {
    if (opts.enabled === false) {
      return;
    }

    isClosedRef.current = false;
    let ws: WebSocket | null = null;
    let reconnectTimeoutId: NodeJS.Timeout | null = null;
    let attemptCount = 0;

    const connect = () => {
      if (isClosedRef.current) return;

      setStatus("connecting");
      const url = new URL(
        opts.url,
        typeof window !== "undefined" ? window.location.origin : undefined,
      );
      if (url.protocol === "http:") url.protocol = "ws:";
      if (url.protocol === "https:") url.protocol = "wss:";

      ws = new WebSocket(url);
      wsRef.current = ws;

      const sendMessage = (msg: any) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(msg));
        }
      };
      sendRef.current = sendMessage;

      ws.onopen = () => {
        attemptCount = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);

          if (parsed.type === "event") {
            setData((prev) => [...prev, parsed.data]);
            optsRef.current.onData?.(parsed.data);
          } else if (parsed.type === "subscribed") {
            setStatus("connected");
            optsRef.current.onSubscribed?.();
            if (parsed.data !== undefined) {
              setData((prev) => [...prev, parsed.data]);
            }
          } else if (parsed.type === "error") {
            setStatus("error");
            setError(parsed.error);
            optsRef.current.onError?.(parsed.error);
          } else {
            if (parsed.data !== undefined) {
              setData((prev) => [...prev, parsed.data]);
            } else {
              setData((prev) => [...prev, parsed as TOutput]);
            }
          }
        } catch {
          setData((prev) => [...prev, event.data as TOutput]);
        }
      };

      ws.onclose = () => {
        if (isClosedRef.current) {
          setStatus("idle");
          return;
        }

        setStatus("idle");

        const reconnectOpts = optsRef.current.reconnect;
        if (reconnectOpts) {
          const maxAttempts = reconnectOpts.maxAttempts ?? 5;
          if (attemptCount < maxAttempts) {
            const delayFn =
              reconnectOpts.delay ??
              ((attempt) => Math.min(1000 * Math.pow(2, attempt), 30000));
            const delay =
              typeof delayFn === "function" ? delayFn(attemptCount) : delayFn;

            attemptCount++;
            reconnectTimeoutId = setTimeout(() => {
              connect();
            }, delay);
          } else {
            setStatus("error");
            setError({
              success: false,
              handlerName: "useWS",
              statusCode: 408,
              reason: "RETRY_EXHAUSTED",
              message: "Max reconnection attempts reached",
            });
          }
        }
      };

      ws.onerror = () => {
        setStatus("error");
      };
    };

    connect();

    return () => {
      isClosedRef.current = true;
      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("idle");
      optsRef.current.onUnsubscribed?.();
    };
  }, [opts.url, opts.enabled]);

  const send = useCallback((data: any) => {
    sendRef.current(data);
  }, []);

  const arrangedData = useMemo(() => {
    if (optsRef.current.arrange) {
      return optsRef.current.arrange(data);
    }
    return data;
  }, [data]);

  return {
    data: arrangedData,
    status,
    error,
    unsubscribe,
    send,
    isFetchingInitialData,
  };
}
