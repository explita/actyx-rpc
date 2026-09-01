"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ErrorResponse } from "../../types/misc.js";
import type { UseWSOpts, UseWSResult } from "../types.js";
import { parseWindow } from "../../lib/utils.js";

const applyDedup = <T>(
  prev: T[],
  item: T,
  dedupKey: (item: T) => string | number,
): T[] => {
  const key = dedupKey(item);
  const index = prev.findIndex((existing) => dedupKey(existing) === key);
  if (index >= 0) {
    const next = [...prev];
    next[index] = item;
    return next;
  }
  return [...prev, item];
};

const addItem = <T>(
  prev: T[],
  item: T,
  dedupKey?: (item: T) => string | number,
): T[] => (dedupKey ? applyDedup(prev, item, dedupKey) : [...prev, item]);

/**
 * Hook for connecting to a WebSocket server and receiving real-time messages.
 *
 * @param opts Options for the connection, including the WebSocket URL.
 */
export function useWS<
  TInitialData = undefined,
  TOutput = TInitialData extends undefined ? any : TInitialData,
>(opts: UseWSOpts<TOutput>): UseWSResult<TOutput> {
  const [data, setData] = useState(() => {
    if (!opts.initialData) return [];
    if (typeof opts.initialData !== "function") {
      return opts.initialData;
    }
    const result = opts.initialData();
    if (!(result instanceof Promise)) {
      return result;
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
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const dataRef = useRef(data);
  dataRef.current = data;

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
      .catch((err) => {
        if (cancelled) return;
        const errResponse: ErrorResponse = {
          success: false,
          handlerName: "useWS",
          statusCode: 500,
          message: err?.message || "Failed to load initial data",
          reason: "UNEXPECTED_ERROR",
        };
        setError(errResponse);
        optsRef.current.onError?.(errResponse);
      })
      .finally(() => {
        setIsFetchingInitialData(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isClosedRef = useRef(false);
  const pendingMessagesRef = useRef<any[]>([]);

  const unsubscribe = useCallback(() => {
    isClosedRef.current = true;
    pendingMessagesRef.current = [];
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("idle");
    setError(undefined);
  }, []);

  const reconnectTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (opts.enabled === false) {
      return;
    }

    isClosedRef.current = false;
    let ws: WebSocket | null = null;
    let attemptCount = 0;

    const connect = () => {
      if (isClosedRef.current) {
        return;
      }

      setStatus("connecting");
      const url = new URL(
        opts.url,
        typeof window !== "undefined" ? window.location.origin : undefined,
      );
      if (url.protocol === "http:") url.protocol = "ws:";
      if (url.protocol === "https:") url.protocol = "wss:";

      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptCount = 0;
        // Flush pending messages
        const pending = pendingMessagesRef.current;
        pendingMessagesRef.current = [];
        for (const msg of pending) {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
          }
        }
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);

          if (parsed.type === "ping") {
            // Respond immediately
            ws?.send(
              JSON.stringify({
                type: "pong",
                timestamp: new Date().toISOString(),
              }),
            );
          } else if (parsed.type === "subscribed") {
            setStatus("connected");
            optsRef.current.onSubscribed?.();
            if (parsed.data !== undefined) {
              if (optsRef.current.filter?.(parsed.data) ?? true) {
                setData((prev) =>
                  addItem(prev, parsed.data, optsRef.current.dedupKey),
                );
              }
            }
          } else if (parsed.type === "event") {
            const item = parsed.data;
            const dedupKeyFn = optsRef.current.dedupKey;
            const prevData = dataRef.current;
            const existing = dedupKeyFn
              ? prevData.findIndex((i) => dedupKeyFn(i) === dedupKeyFn(item))
              : -1;
            const action = existing >= 0 ? "updated" : "added";

            optsRef.current.onData?.(item, action);

            if (optsRef.current.filter?.(item) ?? true) {
              setData((prev) => addItem(prev, item, dedupKeyFn));
            }
          } else if (parsed.type === "error") {
            setStatus("error");
            setError(parsed.error);
            optsRef.current.onError?.(parsed.error);
          } else {
            const item =
              parsed.data !== undefined ? parsed.data : (parsed as TOutput);
            if (optsRef.current.filter?.(item) ?? true) {
              setData((prev) => addItem(prev, item, optsRef.current.dedupKey));
            }
          }
        } catch {
          const errResponse: ErrorResponse = {
            success: false,
            handlerName: "useWS",
            statusCode: 500,
            message: "Failed to parse message",
            reason: "UNEXPECTED_ERROR",
          };
          optsRef.current.onError?.(errResponse);
        }
      };

      ws.onclose = (evt) => {
        optsRef.current.onUnsubscribed?.(evt);

        if (isClosedRef.current) {
          setStatus("idle");
          return;
        }

        setStatus("idle");

        // Don't reconnect on normal closure
        if (evt.wasClean && evt.code === 1000) {
          // console.log("✅ Normal closure, not reconnecting");
          return;
        }

        const reconnectOpts = optsRef.current.reconnect;
        if (reconnectOpts) {
          const maxAttempts = reconnectOpts.maxAttempts ?? 5;
          if (attemptCount < maxAttempts) {
            const delayFn =
              reconnectOpts.delay ??
              ((attempt) => Math.min(1000 * Math.pow(2, attempt), 30000));
            const delayWindow =
              typeof delayFn === "function" ? delayFn(attemptCount) : delayFn;
            let delay = parseWindow(delayWindow);

            // Exponential backoff with extra delay for 1006
            if (evt.code === 1006) {
              delay += 2000;
              // console.log("⚠️ 1006 error - adding extra delay");
            }

            // console.log(
            // `🔄 Reconnecting in ${delay}ms (attempt ${attemptCount + 1}/${maxAttempts})`,
            // );

            attemptCount++;
            optsRef.current.onReconnectAttempt?.(attemptCount);
            reconnectTimeoutIdRef.current = setTimeout(() => {
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
            optsRef.current.onReconnectFailed?.();
          }
        }
      };

      ws.onerror = () => {
        const errResponse: ErrorResponse = {
          success: false,
          handlerName: "useWS",
          statusCode: 500,
          message: "WebSocket connection error",
          reason: "UNEXPECTED_ERROR",
        };
        setStatus("error");
        setError(errResponse);
        optsRef.current.onError?.(errResponse);
      };
    };

    connect();

    return () => {
      // console.log("🧹 Cleaning up WebSocket");
      isClosedRef.current = true;
      pendingMessagesRef.current = [];
      if (reconnectTimeoutIdRef.current) {
        clearTimeout(reconnectTimeoutIdRef.current);
        reconnectTimeoutIdRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setStatus("idle");
      setError(undefined);
    };
  }, [opts.url, opts.enabled]);

  useEffect(() => {
    const reconnectHandler = () =>
      optsRef.current.onReconnect?.(dataRef.current);
    const focusHandler = () => optsRef.current.onWindowFocus?.(dataRef.current);
    window.addEventListener("online", reconnectHandler);
    window.addEventListener("focus", focusHandler);

    return () => {
      window.removeEventListener("online", reconnectHandler);
      window.removeEventListener("focus", focusHandler);
    };
  }, []);

  const send = useCallback((data: any) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      pendingMessagesRef.current.push(data);
    }
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
