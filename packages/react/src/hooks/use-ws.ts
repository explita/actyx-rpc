"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  UseWSOpts,
  UseWSResult,
  ErrorResponse,
  TypingUser,
  WSTypingOptions,
  ExtractTypingUserFromOutput,
  WsStatus,
} from "../types/main.js";
import { parseWindow } from "../lib/utils.js";
import { Timeout } from "../types/misc.js";
import { actyxStreamTracker } from "../devtools/stream-tracker.js";
import {
  addItem,
  closeSocketSafely,
  defaultExtractTypingUser,
  resolveSendTyping,
} from "../lib/ws-helpers.js";

/**
 * React hook for managing real-time WebSocket connections and bidirectional messaging.
 *
 * Automatically manages connection state (`idle`, `connecting`, `connected`, `error`), message history,
 * deduplication, and sending messages over the active socket.
 *
 * @template TInitialData - Type of optional initial data or initial data generator.
 * @template TOutput - The received message item type.
 *
 * @param opts - Connection options including `url`, `protocols`, `onData`, `onOpen`, `onClose`, and `onError`.
 * @returns A `UseWSResult` object containing `data`, `status`, `send`, `clear`, and `disconnect`.
 *
 * @example
 * ```tsx
 * const { data, send, status } = useWS<ChatMessage>({
 *   url: "wss://api.example.com/chat",
 *   onData: (msg) => console.log("Incoming message:", msg),
 * });
 * ```
 */
export function useWS<
  TOutput,
  TUser,
  TEvent extends { type: string; data?: any } = { type: string; data: TOutput },
>(
  opts: Omit<UseWSOpts<TOutput, TEvent, any>, "typing"> & {
    typing: {
      getUser: (
        data: (TOutput extends object ? TOutput : Record<string, any>) &
          Record<string, any>,
      ) => TUser;
    } & Omit<WSTypingOptions<any, TOutput>, "getUser">;
  },
): UseWSResult<TOutput, TUser>;

export function useWS<
  TOutput = any,
  TEvent extends { type: string; data?: any } = { type: string; data: TOutput },
>(
  opts: UseWSOpts<TOutput, TEvent, ExtractTypingUserFromOutput<TOutput>>,
): UseWSResult<TOutput, TypingUser<ExtractTypingUserFromOutput<TOutput>>>;

export function useWS(opts: UseWSOpts<any, any, any>): UseWSResult<any, any> {
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
  const [status, setStatus] = useState<WsStatus>("idle");
  const [error, setError] = useState<ErrorResponse | undefined>();
  const [isFetchingInitialData, setIsFetchingInitialData] = useState(false);

  // Typing indicator state and timer tracking
  const [typingUsers, setTypingUsers] = useState<TypingUser<any>[]>([]);
  const typingTimersRef = useRef<
    Map<string | number, ReturnType<typeof setTimeout>>
  >(new Map());
  const lastTypingSentRef = useRef<number>(0);

  const clearTypingUser = useCallback((id: string | number) => {
    const timer = typingTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      typingTimersRef.current.delete(id);
    }
    setTypingUsers((prev) => prev.filter((u) => String(u.id) !== String(id)));
  }, []);

  const getTypingConfig = useCallback((): WSTypingOptions<any, any> | null => {
    const t = optsRef.current.typing;
    if (!t || typeof t !== "object") return null;
    return t;
  }, []);

  const wsRef = useRef<WebSocket | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const dataRef = useRef(data);
  dataRef.current = data;
  const currentStreamIdRef = useRef<string | null>(null);

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
        setData(resolved);
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
  const activeUrlRef = useRef<string | null>(null);
  const closeTimeoutIdRef = useRef<Timeout | null>(null);
  const reconnectTimeoutIdRef = useRef<Timeout | null>(null);

  const cleanupConnection = useCallback((reason: string = "Clean unmount") => {
    isClosedRef.current = true;
    pendingMessagesRef.current = [];

    if (closeTimeoutIdRef.current) {
      clearTimeout(closeTimeoutIdRef.current);
      closeTimeoutIdRef.current = null;
    }

    if (reconnectTimeoutIdRef.current) {
      clearTimeout(reconnectTimeoutIdRef.current);
      reconnectTimeoutIdRef.current = null;
    }

    for (const timer of typingTimersRef.current.values()) {
      clearTimeout(timer);
    }
    typingTimersRef.current.clear();
    setTypingUsers([]);

    if (currentStreamIdRef.current) {
      actyxStreamTracker.updateStatus(
        currentStreamIdRef.current,
        "disconnected",
      );
    }

    if (reason === "Clean unmount") {
      // Defer socket closure to the next tick to prevent React 18/19 StrictMode
      // (which synchronously mounts, unmounts, and remounts effects in dev) from
      // destroying and re-creating a phantom connection on the server.
      const socketToClose = wsRef.current;
      closeTimeoutIdRef.current = setTimeout(() => {
        if (socketToClose) {
          closeSocketSafely(socketToClose, reason);
        }
        if (wsRef.current === socketToClose) {
          wsRef.current = null;
          activeUrlRef.current = null;
        }
        closeTimeoutIdRef.current = null;
      }, 0);
    } else {
      if (wsRef.current) {
        closeSocketSafely(wsRef.current, reason);
        wsRef.current = null;
        activeUrlRef.current = null;
      }
    }

    setStatus("idle");
    setError(undefined);
  }, []);

  const disconnect = useCallback(() => {
    cleanupConnection("Disconnected");
  }, [cleanupConnection]);

  const connect = useCallback(() => {
    // Cancel any pending unmount closure (e.g. from React StrictMode remount)
    if (closeTimeoutIdRef.current) {
      clearTimeout(closeTimeoutIdRef.current);
      closeTimeoutIdRef.current = null;
    }

    isClosedRef.current = false;

    // Check if an existing connection for the exact same URL is already open or connecting (StrictMode reuse)
    if (
      wsRef.current &&
      activeUrlRef.current === optsRef.current.url &&
      (wsRef.current.readyState === WebSocket.CONNECTING ||
        wsRef.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    // If URL changed and a previous socket exists, close it immediately
    if (wsRef.current && activeUrlRef.current !== optsRef.current.url) {
      closeSocketSafely(wsRef.current, "URL changed");
      wsRef.current = null;
      activeUrlRef.current = null;
    }

    let attemptCount = 0;

    const doConnect = () => {
      if (isClosedRef.current) {
        return;
      }

      setStatus("connecting");
      const url = new URL(
        optsRef.current.url,
        typeof window !== "undefined" ? window.location.origin : undefined,
      );
      if (url.protocol === "http:") url.protocol = "ws:";
      if (url.protocol === "https:") url.protocol = "wss:";

      const streamId = actyxStreamTracker.registerStream(
        "ws",
        optsRef.current.url,
      );
      currentStreamIdRef.current = streamId;

      const ws = new WebSocket(url);
      wsRef.current = ws;
      activeUrlRef.current = optsRef.current.url;

      ws.onopen = () => {
        attemptCount = 0;
        actyxStreamTracker.updateStatus(streamId, "connected");
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
          actyxStreamTracker.recordEvent(streamId, parsed.type, parsed.data);

          if (parsed.type === "ping") {
            // Respond immediately
            ws?.send(
              JSON.stringify({
                type: "pong",
                timestamp: new Date().toISOString(),
              }),
            );
          } else if (
            parsed.type === "subscribed" ||
            parsed.type === "connected"
          ) {
            setStatus("connected");
            optsRef.current.onConnected?.();
            if (parsed.data !== undefined) {
              if (optsRef.current.filter?.(parsed.data) ?? true) {
                setData((prev) =>
                  addItem(prev, parsed.data, optsRef.current.dedupKey),
                );
              }
            }
          } else if (parsed.type === "error") {
            const error = parsed.data ?? parsed.error;
            setStatus("error");
            setError(error);
            optsRef.current.onError?.(error);
          } else {
            // Every other message is an application event: { type, data } or raw payload
            const isEnvelope =
              parsed !== null && typeof parsed === "object" && "type" in parsed;

            let eventType = "message";
            let eventData = parsed;

            if (isEnvelope) {
              if (
                parsed.type === "event" &&
                parsed.data !== null &&
                typeof parsed.data === "object" &&
                "type" in parsed.data
              ) {
                // Legacy double envelope: { type: "event", data: { type: "...", data: ... } }
                eventType = parsed.data.type;
                eventData =
                  "data" in parsed.data ? parsed.data.data : parsed.data;
              } else {
                // Standard envelope: { type: "...", data: ... }
                eventType = parsed.type;
                eventData = "data" in parsed ? parsed.data : parsed;
              }
            }

            const event = { type: eventType, data: eventData };
            const data = eventData;

            // Handle error event
            if (event.type === "error") {
              const error = event.data;
              setStatus("error");
              setError(error);
              optsRef.current.onError?.(error);
              return;
            }

            // Dedup & action checking runs on the actual entity `data`
            const dedupKeyFn = optsRef.current.dedupKey;
            const prevData = dataRef.current;
            const existing = dedupKeyFn
              ? prevData.findIndex((i) => dedupKeyFn(i) === dedupKeyFn(data))
              : -1;
            const action = existing >= 0 ? "updated" : "added";

            // Check typing indicator event
            const typingCfg = getTypingConfig();
            if (typingCfg) {
              const typingEventName = typingCfg.event ?? "typing";

              if (eventType === typingEventName) {
                const extracted = typingCfg.getUser
                  ? typingCfg.getUser(eventData)
                  : defaultExtractTypingUser(eventData);

                const user: TypingUser<any> =
                  typeof extracted === "object" &&
                  extracted !== null &&
                  "id" in extracted
                    ? extracted
                    : ({
                        id: extracted,
                        name:
                          typeof extracted === "string" ? extracted : undefined,
                      } as any);

                // Notify onData callback
                optsRef.current.onData?.(event as any, "added");

                // Check for an explicit stop event
                const isStopped =
                  eventData?.isTyping === false ||
                  eventData?.typing === false ||
                  eventData?.status === "stopped" ||
                  eventData?.status === "idle";

                if (isStopped) {
                  clearTypingUser(user.id);
                  return;
                }

                // Check if this typing event is from the current user
                const isCurrent =
                  // typeof typingCfg.currentUserId === "function"
                  //   ? typingCfg.currentUserId(user)
                  //   :
                  typingCfg.currentUserId !== undefined &&
                  typingCfg.currentUserId !== null
                    ? String(user.id) === String(typingCfg.currentUserId)
                    : false;

                if (isCurrent) {
                  return;
                }

                // Reset per-user timer
                const existingTimer = typingTimersRef.current.get(user.id);
                if (existingTimer) {
                  clearTimeout(existingTimer);
                }

                const timeoutMs = parseWindow(typingCfg.timeout ?? "2s");
                const timer = setTimeout(() => {
                  clearTypingUser(user.id);
                }, timeoutMs);
                typingTimersRef.current.set(user.id, timer);

                // Add or update user in typingUsers
                setTypingUsers((prev) => {
                  const idx = prev.findIndex((u) => u.id === user.id);
                  if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = user;
                    return next;
                  }
                  return [...prev, user];
                });

                // Do NOT add ephemeral typing event to persistent data state!
                return;
              } else if (typingCfg.clearOnMessage !== false) {
                // Actual message arrived: clear the author's typing indicator immediately
                const author = typingCfg.getUser
                  ? typingCfg.getUser(eventData)
                  : defaultExtractTypingUser(eventData);

                const authorId =
                  typeof author === "object" && author !== null
                    ? "id" in author
                      ? author.id
                      : undefined
                    : typeof author === "string" || typeof author === "number"
                      ? author
                      : undefined;

                if (
                  authorId !== undefined &&
                  authorId !== null &&
                  authorId !== "unknown"
                ) {
                  clearTypingUser(authorId);
                } else if (
                  typingTimersRef.current.has("unknown") ||
                  typingUsers.length === 1
                ) {
                  clearTypingUser("unknown");
                }
              }
            }

            // onData gets event (with event.type and event.data) and accurate action
            optsRef.current.onData?.(event as any, action);

            // Filter and internal state operate on `data` (clean TOutput)
            if (optsRef.current.filter?.(data) ?? true) {
              if (data !== undefined) {
                setData((prev) => addItem(prev, data, dedupKeyFn));
              }
            }
          }
        } catch (err: any) {
          const message = err?.message ?? "Failed to parse message";
          const errResponse: ErrorResponse = {
            success: false,
            handlerName: "useWS",
            statusCode: 500,
            message,
            reason: "UNEXPECTED_ERROR",
          };
          setError(errResponse);
          optsRef.current.onError?.(errResponse);
        }
      };

      ws.onclose = (evt) => {
        optsRef.current.onDisconnected?.(evt);

        setStatus("idle");

        if (isClosedRef.current) {
          return;
        }

        // Don't reconnect on normal closure
        if (evt.wasClean && evt.code === 1000) {
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

            if (evt.code === 1006) {
              delay += 2000;
            }

            attemptCount++;
            optsRef.current.onReconnectAttempt?.(attemptCount);
            reconnectTimeoutIdRef.current = setTimeout(() => {
              doConnect();
            }, delay);
            setStatus("reconnecting");
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

    doConnect();
  }, [clearTypingUser, getTypingConfig]);

  useEffect(() => {
    if (opts.enabled === false) {
      return;
    }

    connect();

    return () => {
      cleanupConnection("Clean unmount");
    };
  }, [opts.url, opts.enabled, connect]);

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
    lastTypingSentRef.current = 0;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    } else {
      pendingMessagesRef.current.push(data);
    }
  }, []);

  const sendTyping = useCallback(
    (payload?: any) => {
      const typingCfg = getTypingConfig();
      const throttleMs = parseWindow(typingCfg?.throttle ?? "1.5s");
      const now = Date.now();
      if (now - lastTypingSentRef.current < throttleMs) {
        return;
      }
      lastTypingSentRef.current = now;

      const eventName = typingCfg?.event ?? "typing";
      const typingEvent = resolveSendTyping(typingCfg, payload, eventName);

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(typingEvent));
      } else {
        pendingMessagesRef.current.push(typingEvent);
      }
    },
    [getTypingConfig],
  );

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
    connect,
    disconnect,
    send,
    isFetchingInitialData,
    isTyping: typingUsers.length > 0,
    typingUsers,
    sendTyping,
  };
}
