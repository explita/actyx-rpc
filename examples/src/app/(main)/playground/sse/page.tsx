"use client";

import { SSEClient } from "@/dist/client/sse";
import { useSSE } from "@/dist/react";
import { useEffect, useState, useRef } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Terminal,
  Zap,
} from "lucide-react";

type StockUpdate = {
  symbol: string;
  price: number;
  at: string;
};

export default function SSEDemo() {
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

  const [hookSymbol, setHookSymbol] = useState("MSFT");

  const { data: hookUpdates, isConnected: isHookConnected } =
    useSSE<StockUpdate>({
      url: "/api/sse",
      params: { symbol: hookSymbol },
      maxHistory: 15,
      arrange: (data) => {
        return data.sort(
          (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
        );
      },
      //or just
      //arrange: (data) => data.reverse(),
    });

  const latestManualPrice = manualUpdates[0]?.price || 0;
  const previousManualPrice = manualUpdates[1]?.price || latestManualPrice;
  const manualDiff = latestManualPrice - previousManualPrice;
  const isManualUp = manualDiff >= 0;

  const latestHookPrice = hookUpdates[0]?.price || 0;
  const previousHookPrice = hookUpdates[1]?.price || latestHookPrice;
  const hookDiff = latestHookPrice - previousHookPrice;
  const isHookUp = hookDiff >= 0;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
      <div className="mb-10">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity
            size={24}
            className="text-emerald-600 dark:text-emerald-400"
          />
          Server-Sent Events
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Real-time data streaming via SSE. Compare low-level manual iteration
          against the{" "}
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-emerald-600 dark:text-emerald-400">
            useSSE
          </code>{" "}
          hook.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Manual Connection Card */}
        <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between shadow-sm">
          <div>
            <div className="bg-slate-900 dark:bg-slate-950 p-6 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl font-bold text-white">
                    {manualSymbol}
                  </span>
                  <div
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      isManualConnected
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-rose-500/20 text-rose-400"
                    }`}
                  >
                    {isManualConnected ? "LIVE" : "DISCONNECTED"}
                  </div>
                </div>
                <p className="text-slate-400 text-xs flex items-center gap-1.5 mt-1">
                  <Terminal className="h-3.5 w-3.5 text-slate-500" />
                  Manual SSEClient Connection
                </p>
              </div>

              <select
                value={manualSymbol}
                onChange={(e) => setManualSymbol(e.target.value)}
                className="bg-slate-800 dark:bg-slate-900 text-white border-slate-700 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 py-2 px-3"
              >
                <option value="AAPL">AAPL</option>
                <option value="MSFT">MSFT</option>
                <option value="GOOGL">GOOGL</option>
                <option value="TSLA">TSLA</option>
              </select>
            </div>

            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-end gap-4 bg-slate-50/50 dark:bg-slate-950/30">
              <span className="text-5xl font-light text-slate-900 dark:text-white tabular-nums tracking-tight">
                ${latestManualPrice.toFixed(2)}
              </span>
              {manualUpdates.length > 1 && (
                <div
                  className={`flex items-center text-md font-semibold mb-1.5 ${
                    isManualUp
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
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

            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                Stream History
              </h3>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2">
                {manualUpdates.map((update, idx) => (
                  <div
                    key={`${update.at}-${idx}`}
                    className="flex justify-between items-center bg-white dark:bg-slate-950/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-sm"
                  >
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {new Date(update.at).toLocaleTimeString([], {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                      ${update.price.toFixed(2)}
                    </span>
                  </div>
                ))}

                {manualUpdates.length === 0 && (
                  <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                    Connecting to async iterator...
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/30 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center">
            Requires managing state hooks, refs, abort handlers, and effects
            manually.
          </div>
        </div>

        {/* Hook Connection Card */}
        <div className="bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col justify-between shadow-sm">
          <div>
            <div className="bg-indigo-950 dark:bg-indigo-950/90 p-6 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl font-bold text-white">
                    {hookSymbol}
                  </span>
                  <div
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      isHookConnected
                        ? "bg-indigo-400/20 text-indigo-300"
                        : "bg-rose-500/20 text-rose-400"
                    }`}
                  >
                    {isHookConnected ? "LIVE" : "DISCONNECTED"}
                  </div>
                </div>
                <p className="text-indigo-200 text-xs flex items-center gap-1.5 mt-1">
                  <Zap className="h-3.5 w-3.5 text-indigo-400" />
                  useSSE Reactive Hook
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

            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-end gap-4 bg-indigo-50/20 dark:bg-indigo-950/20">
              <span className="text-5xl font-light text-slate-900 dark:text-white tabular-nums tracking-tight">
                ${latestHookPrice.toFixed(2)}
              </span>
              {hookUpdates.length > 1 && (
                <div
                  className={`flex items-center text-md font-semibold mb-1.5 ${
                    isHookUp
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
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

            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                Stream History (maxHistory: 15)
              </h3>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2">
                {hookUpdates.map((update, idx) => (
                  <div
                    key={`${update.at}-${idx}`}
                    className="flex justify-between items-center bg-white dark:bg-slate-950/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-sm"
                  >
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-xs">
                      {new Date(update.at).toLocaleTimeString([], {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white tabular-nums">
                      ${update.price.toFixed(2)}
                    </span>
                  </div>
                ))}

                {hookUpdates.length === 0 && (
                  <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-sm">
                    Connecting to hook stream...
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="p-4 bg-slate-50/50 dark:bg-slate-950/30 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 text-center">
            Handled seamlessly in 1 line of declarative code. Auto-cleanup and
            history trimming built-in.
          </div>
        </div>
      </div>
    </div>
  );
}
