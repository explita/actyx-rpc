"use client";

import { useEffect, useRef, useState } from "react";
import type { ErrorResponse } from "../../types/misc.js";
import type { UseSubscriptionOpts, UseSubscriptionReturn } from "../types.js";

/**
 * Hook for subscribing to real-time events via Actyx-RPC subscriptions.
 *
 * @param proc The pre-bound subscription procedure (e.g. `myProc(input)`).
 * @param opts Options for the subscription, including the WebSocket URL.
 */
export function useSubscription<TOutput>(
  proc: (wsContext: any) => Promise<void>,
  opts: UseSubscriptionOpts<TOutput>,
): UseSubscriptionReturn<TOutput> {
  const [data, setData] = useState<TOutput | undefined>();
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [error, setError] = useState<ErrorResponse | undefined>();
  const wsRef = useRef<WebSocket | null>(null);

  const unsubscribe = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus("idle");
    opts.onUnsubscribed?.();
  };

  useEffect(() => {
    if (opts.enabled === false) {
      return;
    }

    setStatus("connecting");
    const url = new URL(
      opts.wsUrl,
      typeof window !== "undefined" ? window.location.origin : undefined,
    );
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol === "https:") url.protocol = "wss:";

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = async () => {
      // Use the pre-bound procedure directly
      await proc({
        send: (msg: any) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
          }
        },
        onMessage: (cb: (data: any) => void) => {
          ws.onmessage = (event) => {
            try {
              const parsed = JSON.parse(event.data);

              if (parsed.type === "event") {
                setData(parsed.data);
                opts.onData?.(parsed.data);
              } else if (parsed.type === "subscribed") {
                setStatus("connected");
                opts.onSubscribed?.();
              } else if (parsed.type === "error") {
                setStatus("error");
                setError(parsed.error);
                opts.onError?.(parsed.error);
              }

              cb(parsed);
            } catch (err) {
              cb(event.data);
            }
          };
        },
        onClose: (cb: () => void) => {
          ws.onclose = () => {
            cb();
            if (status !== "idle") setStatus("idle");
          };
        },
        onError: (cb: (err: any) => void) => {
          ws.onerror = (err) => {
            cb(err);
            setStatus("error");
          };
        },
      });
    };

    return () => {
      unsubscribe();
    };
  }, [proc, opts.wsUrl, opts.enabled]);

  return {
    data,
    status,
    error,
    unsubscribe,
  };
}
