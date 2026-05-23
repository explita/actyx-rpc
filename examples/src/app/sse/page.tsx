"use client";

import { SSEClient } from "@/dist/client/sse";
import { useSSE } from "@/dist/react";
import { useEffect, useState, useRef } from "react";
import { Activity, TrendingUp, TrendingDown, Clock, Terminal, Zap } from "lucide-react";

type StockUpdate = {
  symbol: string;
  price: number;
  at: string;
};

export default function SSEDemo() {
  // --- Manual Connection (AAPL) ---
  const [manualUpdates, setManualUpdates] = useState<StockUpdate[]>([]);
  const [isManualConnected, setIsManualConnected] = useState(false);
  const [manualSymbol, setManualSymbol] = useState("AAPL");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const startStream = async () => {
      abortControllerRef.current = new AbortController();
      setIsManualConnected(true);
      setManualUpdates([]);

      try {
        const stream = await SSEClient({
          url: "/api/sse",
          params: { symbol: manualSymbol },
          signal: abortControllerRef.current.signal,
        });

        for await (const { event, data } of stream) {
          if (event === "price-update") {
            const parsed = typeof data === "string" ? JSON.parse(data) : data;

            setManualUpdates((prev) => {
              const next = [parsed, ...prev];
              if (next.length > 15) return next.slice(0, 15);
              return next;
            });
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Stream manually aborted");
        } else {
          console.error("SSE stream error", err);
        }
      } finally {
        setIsManualConnected(false);
      }
    };

    startStream();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [manualSymbol]);

  // --- Hook Connection (MSFT) ---
  const [hookSymbol, setHookSymbol] = useState("MSFT");

  const {
    data: hookData,
    isConnected: isHookConnected,
  } = useSSE<StockUpdate>({
    url: "/api/sse",
    params: { symbol: hookSymbol },
    maxHistory: 15,
  });

  // Since hookData accumulates in append order (oldest first),
  // we want to display it newest first to match the manual display logic
  const hookUpdates = [...hookData].reverse();

  // Manual pricing diff calculations
  const latestManualPrice = manualUpdates[0]?.price || 0;
  const previousManualPrice = manualUpdates[1]?.price || latestManualPrice;
  const manualDiff = latestManualPrice - previousManualPrice;
  const isManualUp = manualDiff >= 0;

  // Hook pricing diff calculations
  const latestHookPrice = hookUpdates[0]?.price || 0;
  const previousHookPrice = hookUpdates[1]?.price || latestHookPrice;
  const hookDiff = latestHookPrice - previousHookPrice;
  const isHookUp = hookDiff >= 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-12">
        <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Activity className="h-8 w-8 text-emerald-600" />
          Server-Sent Events
        </h2>
        <p className="mt-2 text-gray-600">
          Demonstrating one-way real-time data streaming from the server. Compare low-level manual iteration against the clean and simple `useSSE` hook.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Manual Connection Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="bg-gray-900 p-6 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl font-bold text-white">{manualSymbol}</span>
                  <div
                    className={`px-2 py-0.5 rounded text-xs font-medium ${isManualConnected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
                  >
                    {isManualConnected ? "LIVE" : "DISCONNECTED"}
                  </div>
                </div>
                <p className="text-gray-400 text-xs flex items-center gap-1.5 mt-1">
                  <Terminal className="h-3.5 w-3.5 text-gray-500" />
                  Manual `SSEClient` Connection
                </p>
              </div>

              <select
                value={manualSymbol}
                onChange={(e) => setManualSymbol(e.target.value)}
                className="bg-gray-800 text-white border-gray-700 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 py-2 px-3"
              >
                <option value="AAPL">AAPL</option>
                <option value="MSFT">MSFT</option>
                <option value="GOOGL">GOOGL</option>
                <option value="TSLA">TSLA</option>
              </select>
            </div>

            {/* Price Display */}
            <div className="p-6 border-b border-gray-100 flex items-end gap-4 bg-gray-50/30">
              <span className="text-5xl font-light text-gray-900 tabular-nums tracking-tight">
                ${latestManualPrice.toFixed(2)}
              </span>
              {manualUpdates.length > 1 && (
                <div
                  className={`flex items-center text-md font-semibold mb-1.5 ${isManualUp ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {isManualUp ? (
                    <TrendingUp className="h-4 w-4 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-1" />
                  )}
                  {Math.abs(manualDiff).toFixed(2)}
                </div>
              )}
            </div>

            {/* Feed History */}
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                Stream History
              </h3>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 font-sans">
                {manualUpdates.map((update, idx) => (
                  <div
                    key={`${update.at}-${idx}`}
                    className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-150 shadow-sm text-sm"
                  >
                    <span className="text-gray-500 font-mono text-xs">
                      {new Date(update.at).toLocaleTimeString([], {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      ${update.price.toFixed(2)}
                    </span>
                  </div>
                ))}

                {manualUpdates.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    Connecting to async iterator...
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500 text-center">
            Requires managing state hooks, refs, abort handlers, and effects manually.
          </div>
        </div>

        {/* Hook Connection Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col justify-between">
          <div>
            {/* Header */}
            <div className="bg-indigo-950 p-6 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl font-bold text-white">{hookSymbol}</span>
                  <div
                    className={`px-2 py-0.5 rounded text-xs font-medium ${isHookConnected ? "bg-indigo-400/20 text-indigo-300" : "bg-red-500/20 text-red-400"}`}
                  >
                    {isHookConnected ? "LIVE" : "DISCONNECTED"}
                  </div>
                </div>
                <p className="text-indigo-200 text-xs flex items-center gap-1.5 mt-1">
                  <Zap className="h-3.5 w-3.5 text-indigo-400" />
                  `useSSE` Reactive Hook
                </p>
              </div>

              <select
                value={hookSymbol}
                onChange={(e) => setHookSymbol(e.target.value)}
                className="bg-indigo-900 text-white border-indigo-800 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500 py-2 px-3"
              >
                <option value="MSFT">MSFT</option>
                <option value="AAPL">AAPL</option>
                <option value="GOOGL">GOOGL</option>
                <option value="TSLA">TSLA</option>
              </select>
            </div>

            {/* Price Display */}
            <div className="p-6 border-b border-gray-100 flex items-end gap-4 bg-indigo-50/10">
              <span className="text-5xl font-light text-gray-900 tabular-nums tracking-tight">
                ${latestHookPrice.toFixed(2)}
              </span>
              {hookUpdates.length > 1 && (
                <div
                  className={`flex items-center text-md font-semibold mb-1.5 ${isHookUp ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {isHookUp ? (
                    <TrendingUp className="h-4 w-4 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 mr-1" />
                  )}
                  {Math.abs(hookDiff).toFixed(2)}
                </div>
              )}
            </div>

            {/* Feed History */}
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                Stream History (maxHistory: 15)
              </h3>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 font-sans">
                {hookUpdates.map((update, idx) => (
                  <div
                    key={`${update.at}-${idx}`}
                    className="flex justify-between items-center bg-white p-3 rounded-lg border border-gray-150 shadow-sm text-sm"
                  >
                    <span className="text-gray-500 font-mono text-xs">
                      {new Date(update.at).toLocaleTimeString([], {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      ${update.price.toFixed(2)}
                    </span>
                  </div>
                ))}

                {hookUpdates.length === 0 && (
                  <div className="text-center py-12 text-gray-400 text-sm">
                    Connecting to hook stream...
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500 text-center">
            Handled seamlessly in 1 line of declarative code. Auto-cleanup and history trimming built-in.
          </div>
        </div>
      </div>
    </div>
  );
}
