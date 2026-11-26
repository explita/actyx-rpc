import { TypingUser } from "../types/main";

export const applyDedup = <T>(
  prev: T[],
  item: T,
  dedupKey: (item: T) => unknown,
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

export function addItem<T>(
  prev: T[],
  item: T,
  dedupKey?: (item: T) => unknown,
) {
  return dedupKey ? applyDedup(prev, item, dedupKey) : [...prev, item];
}

export function closeSocketSafely(
  ws: WebSocket | null,
  reason = "Clean unmount",
) {
  if (!ws) return;
  // Detach handlers immediately so no events fire into an unmounted/unsubscribed hook
  ws.onmessage = null;
  ws.onerror = null;
  ws.onclose = null;

  const CONNECTING =
    typeof WebSocket !== "undefined" ? WebSocket.CONNECTING : 0;
  const OPEN = typeof WebSocket !== "undefined" ? WebSocket.OPEN : 1;

  if (ws.readyState === CONNECTING) {
    // If the socket is still CONNECTING, calling ws.close() immediately aborts the
    // handshake and causes Chromium to log:
    // "WebSocket connection to '...' failed: WebSocket is closed before the connection is established."
    // (very common in React Strict Mode mount-unmount-remount cycles).
    // Deferring close until onopen fires completes the handshake cleanly with code 1000.
    ws.onopen = () => {
      try {
        ws.close(1000, reason);
      } catch {
        try {
          ws.close();
        } catch {}
      }
    };
  } else if (ws.readyState === OPEN) {
    try {
      ws.close(1000, reason);
    } catch {
      try {
        ws.close();
      } catch {}
    }
  } else {
    try {
      ws.close();
    } catch {}
  }
}

export function defaultExtractTypingUser(data: any): TypingUser {
  if (data === null || data === undefined) {
    return { id: "unknown" };
  }
  if (typeof data !== "object") {
    return { id: String(data), name: String(data) };
  }

  // 1. Standard: data.user ({ id, name, ... } or primitive identifier)
  if (data.user !== undefined && data.user !== null) {
    if (typeof data.user === "object") {
      const id = data.user.id ?? data.user._id ?? "unknown";
      const name = data.user.name ?? data.user.username;
      return { ...data.user, id, name };
    }
    return { id: String(data.user), name: String(data.user) };
  }

  // 2. Standard: data.sender ({ id, name, ... } or primitive identifier)
  if (data.sender !== undefined && data.sender !== null) {
    if (typeof data.sender === "object") {
      const id = data.sender.id ?? data.sender._id ?? "unknown";
      const name = data.sender.name ?? data.sender.username;
      return { ...data.sender, id, name };
    }
    return { id: String(data.sender), name: String(data.sender) };
  }

  // 3. Standard: data.author ({ id, name, ... } or primitive identifier)
  if (data.author !== undefined && data.author !== null) {
    if (typeof data.author === "object") {
      const id = data.author.id ?? data.author._id ?? "unknown";
      const name = data.author.name ?? data.author.username;
      return { ...data.author, id, name };
    }
    return { id: String(data.author), name: String(data.author) };
  }

  // 4. Flat convention: data.userId / data.userName
  if (data.userId !== undefined && data.userId !== null) {
    return {
      ...data,
      id: data.userId,
      name: data.userName ?? data.name,
    };
  }

  // 5. Flat convention: data.senderId / data.senderName
  if (data.senderId !== undefined && data.senderId !== null) {
    return {
      ...data,
      id: data.senderId,
      name: data.senderName ?? data.name,
    };
  }

  // 6. Flat convention: data.authorId / data.authorName
  if (data.authorId !== undefined && data.authorId !== null) {
    return {
      ...data,
      id: data.authorId,
      name: data.authorName ?? data.name,
    };
  }

  return { id: "unknown" };
}

export function resolveSendTyping(
  typingCfg: any,
  payload: any,
  eventName: any,
) {
  let dataPayload = payload;

  if (
    typingCfg?.currentUserId !== undefined &&
    typeof typingCfg.currentUserId !== "function"
  ) {
    if (dataPayload === undefined) {
      dataPayload = {
        isTyping: true,
        user: { id: typingCfg.currentUserId },
      };
    } else if (typeof dataPayload === "boolean") {
      // Allows `sendTyping(true)` or `sendTyping(false)` directly
      dataPayload = {
        isTyping: dataPayload,
        user: { id: typingCfg.currentUserId },
      };
    } else if (
      typeof dataPayload === "object" &&
      dataPayload !== null &&
      !dataPayload.user &&
      !dataPayload.sender &&
      !dataPayload.author &&
      !dataPayload.userId
    ) {
      // Preserves `{ isTyping: true/false, ... }` and merges `user`
      dataPayload = {
        ...dataPayload,
        user: { id: typingCfg.currentUserId },
      };
    }
  }

  return { type: eventName, data: dataPayload };
}
