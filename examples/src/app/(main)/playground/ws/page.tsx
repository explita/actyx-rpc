"use client";

import { useWS } from "@/dist/react";
import { sendRoomMessage } from "@/lib/rpc/actions";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Radio,
  Wifi,
  WifiOff,
  Send,
  Terminal,
  Loader2,
  MessageSquare,
  Pencil,
  Hash,
  Globe,
} from "lucide-react";

type WsMessage = { message: string; type?: never };
type WsTyping = { type: "typing" };
type WsData = WsMessage | WsTyping;

// ==========================================
// 1. Global Chat Demo Component
// ==========================================
function GlobalChatDemo() {
  const [input, setInput] = useState("");
  const [isSomeoneTyping, setIsSomeoneTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const { data, status, unsubscribe, send } = useWS<WsData>({
    url: "/api/ws",
  });

  const messages = data.filter(
    (item): item is WsMessage =>
      item !== null && typeof item === "object" && "message" in item,
  );

  useEffect(() => {
    const lastItem = data[data.length - 1];
    if (
      lastItem &&
      typeof lastItem === "object" &&
      "type" in lastItem &&
      (lastItem as any).type === "typing"
    ) {
      setIsSomeoneTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        setIsSomeoneTyping(false);
      }, 2000);
    } else if (
      lastItem &&
      typeof lastItem === "object" &&
      "message" in lastItem
    ) {
      setIsSomeoneTyping(false);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    }
  }, [data]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInput(value);

      if (value.trim()) {
        const now = Date.now();
        if (now - lastTypingSentRef.current > 1500) {
          send({ type: "typing" });
          lastTypingSentRef.current = now;
        }
      }
    },
    [send],
  );

  const sendMessage = () => {
    if (!input.trim()) return;
    send({ message: input.trim() });
    setInput("");
    lastTypingSentRef.current = 0;
  };

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";

  return (
    <>
      {/* Status bar */}
      <div className="mb-4 flex items-center gap-3 text-sm">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isConnected
              ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
              : isConnecting
                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                : "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
          }`}
        >
          {isConnected ? (
            <Wifi size={12} />
          ) : isConnecting ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <WifiOff size={12} />
          )}
          {isConnected
            ? "Connected"
            : isConnecting
              ? "Connecting..."
              : "Disconnected"}
        </span>

        <button
          onClick={unsubscribe}
          disabled={!isConnected}
          className="text-xs text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
        >
          Disconnect
        </button>
      </div>

      {/* Chat-like message log */}
      <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <Terminal size={14} className="text-slate-400" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Global Chat Log
          </span>
        </div>

        <div
          className="h-80 overflow-y-auto p-4 space-y-2 font-mono text-sm"
          ref={scrollRef}
        >
          {messages.length === 0 && (
            <p className="text-slate-400 dark:text-slate-600 italic">
              {isConnected
                ? "Listening for messages..."
                : "Waiting for connection..."}
            </p>
          )}
          {messages.map((item, i) => {
            return (
              <div
                key={i}
                className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300"
              >
                {item.message}
              </div>
            );
          })}

          {/* Typing indicator */}
          {isSomeoneTyping && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 dark:text-slate-500 text-xs animate-pulse">
              <Pencil size={12} />
              <span>Someone is typing...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 p-3">
          <input
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            placeholder="Type a message..."
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={!isConnected}
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || !input.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed cursor-pointer"
          >
            <Send size={14} />
            Send
          </button>
        </div>
      </div>
    </>
  );
}

// ==========================================
// 2. Pub/Sub Rooms Demo Component
// ==========================================
function PubSubRoomsDemo() {
  const [roomId, setRoomId] = useState("general");
  const [roomInput, setRoomInput] = useState("");
  const roomScrollRef = useRef<HTMLDivElement>(null);

  const {
    data: roomData,
    status: roomStatus,
    unsubscribe: unsubscribeRoom,
  } = useWS<{ message: string }>({
    url: `/api/ws/room?roomId=${roomId}`,
    enabled: !!roomId,
  });

  const roomMessages = roomData.filter(
    (item): item is { message: string } =>
      item !== null && typeof item === "object" && "message" in item,
  );

  useEffect(() => {
    roomScrollRef.current?.scrollTo({
      top: roomScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [roomMessages.length]);

  const sendRoomMsg = async () => {
    if (!roomInput.trim()) return;
    const [, error] = await sendRoomMessage({
      roomId,
      message: roomInput.trim(),
    });
    if (!error) {
      setRoomInput("");
    }
  };

  const isRoomConnected = roomStatus === "connected";
  const isRoomConnecting = roomStatus === "connecting";

  return (
    <>
      {/* Status bar */}
      <div className="mb-4 flex items-center justify-between gap-3 text-sm flex-wrap">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              isRoomConnected
                ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : isRoomConnecting
                  ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                  : "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
            }`}
          >
            {isRoomConnected ? (
              <Wifi size={12} />
            ) : isRoomConnecting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <WifiOff size={12} />
            )}
            {isRoomConnected
              ? `Subscribed: room:${roomId}`
              : isRoomConnecting
                ? "Connecting..."
                : "Disconnected"}
          </span>

          <button
            onClick={unsubscribeRoom}
            disabled={!isRoomConnected && !isRoomConnecting}
            className="text-xs text-slate-500 dark:text-slate-400 underline hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed cursor-pointer"
          >
            Disconnect
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Room ID:
          </span>
          <input
            className="w-32 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500/40 font-mono"
            placeholder="room-id"
            value={roomId}
            onChange={(e) =>
              setRoomId(e.target.value.toLowerCase().replace(/\s+/g, ""))
            }
          />
        </div>
      </div>

      {/* PubSub room message log */}
      <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <Terminal size={14} className="text-slate-400" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Pub/Sub Channel:{" "}
            <code className="text-blue-600 dark:text-blue-400 font-mono">
              room:{roomId}
            </code>
          </span>
        </div>

        <div
          className="h-80 overflow-y-auto p-4 space-y-2 font-mono text-sm"
          ref={roomScrollRef}
        >
          {roomMessages.length === 0 && (
            <p className="text-slate-400 dark:text-slate-600 italic">
              {isRoomConnected
                ? `No publications received in room:${roomId} yet. Open another tab in this room to chat!`
                : "Waiting for subscription..."}
            </p>
          )}
          {roomMessages.map((item, i) => {
            return (
              <div
                key={i}
                className="px-3 py-1.5 rounded-lg bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/20 text-slate-700 dark:text-slate-300"
              >
                {item.message}
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 p-3">
          <input
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            placeholder={`Publish message to room:${roomId}...`}
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendRoomMsg()}
            disabled={!isRoomConnected}
          />
          <button
            onClick={sendRoomMsg}
            disabled={!isRoomConnected || !roomInput.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-sm font-medium transition-colors disabled:cursor-not-allowed cursor-pointer"
          >
            <Send size={14} />
            Publish
          </button>
        </div>
      </div>
    </>
  );
}

// ==========================================
// Main WSDemo Component
// ==========================================
export default function WSDemo() {
  const [activeTab, setActiveTab] = useState<"chat" | "pubsub">("chat");

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Radio size={24} className="text-blue-600 dark:text-blue-400" />
          WebSocket (useWS)
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Real-time bidirectional communication and Pub/Sub subscriptions via
          the{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-blue-600 dark:text-blue-400">
            useWS
          </code>{" "}
          hook.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "chat"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Globe size={16} />
          Global Chat
        </button>
        <button
          onClick={() => setActiveTab("pubsub")}
          className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "pubsub"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Hash size={16} />
          Pub/Sub Rooms
        </button>
      </div>

      {activeTab === "chat" ? <GlobalChatDemo /> : <PubSubRoomsDemo />}

      {/* Info card */}
      <div className="mt-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
        <div className="flex items-start gap-3">
          <MessageSquare
            size={18}
            className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0"
          />
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <p className="font-semibold text-slate-800 dark:text-slate-200">
              How it works
            </p>
            <p>
              <strong>Global Chat:</strong> A raw bi-directional WebSocket
              handler. Message broadcasts are handled manually on the socket
              loop.
            </p>
            <p>
              <strong>Pub/Sub Rooms:</strong> Demonstrates topic-based
              subscription separation. The client subscribes via WebSocket to
              receive messages on a specific channel, but publishes messages
              using standard <strong>RPC mutations</strong>. Any tab subscribed
              to the same Room ID will instantly receive the broadcast.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
