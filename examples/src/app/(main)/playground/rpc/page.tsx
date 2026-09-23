"use client";

import { rpc } from "@/lib/rpc/client";
import { useState } from "react";
import {
  Loader2,
  Plus,
  Network,
  CheckCircle2,
  Circle,
  Activity,
  Server,
  Code2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

export default function RPCRouterPlayground() {
  const [inputText, setInputText] = useState("");
  const [lastCall, setLastCall] = useState<string>("POST /api/rpc/todos.list");

  // Query todos via proxy SDK
  const {
    data: todos,
    isLoading: isTodosLoading,
    refetch,
    isRefetching,
    append,
  } = rpc.todos.list.useQuery({
    onSuccess: () => setLastCall("GET /api/rpc/todos.list"),
    unwrap: true,
  });

  // Query health status
  const { data: health } = rpc.health.useQuery();

  // Mutations via proxy SDK
  const {
    mutate: addTodo,
    isPending: isAdding,
    error,
  } = rpc.todos.add.useMutation({
    onSuccess: (res) => {
      setInputText("");
      setLastCall("POST /api/rpc/todos.add");
      rpc.todos.list.invalidate();
    },
  });

  const { mutate: toggleTodo } = rpc.todos.toggle.useMutation({
    onSuccess: () => {
      setLastCall("POST /api/rpc/todos.toggle");
      rpc.todos.list.invalidate();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdding) return;
    addTodo({ text: inputText.trim() });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 text-xs font-semibold">
          <Network size={13} />
          <span>tRPC Parity Feature</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          tRPC-Style Catch-All Router
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
          Demonstrates full tRPC-style path routing using a Next.js App Router
          catch-all route{" "}
          <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-blue-600 dark:text-blue-400">
            app/api/rpc/[...rpc]/route.ts
          </code>{" "}
          and consuming it with the typed client proxy SDK.
        </p>
      </div>

      {/* Health & Live Inspector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Activity size={18} />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Endpoint Health
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {health?.status === "ok" ? "200 OK — Healthy" : "Checking..."}
              </div>
            </div>
          </div>
          {health?.uptime !== undefined && (
            <span className="text-xs font-mono text-slate-400">
              uptime: {health.uptime}s
            </span>
          )}
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Server size={18} />
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Last Routed Call
              </div>
              <div className="text-sm font-mono font-medium text-slate-900 dark:text-white">
                {lastCall}
              </div>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refetch todos"
          >
            <RefreshCw
              size={14}
              className={isRefetching ? "animate-spin text-blue-500" : ""}
            />
          </button>
        </div>
      </div>

      {/* Main Interactive Demo Container */}
      <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden mb-8">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Router Todos Demo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Fetched via{" "}
              <code className="font-mono text-blue-600 dark:text-blue-400">
                rpc.todos.list.useQuery()
              </code>
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {todos?.length ?? 0} items
          </span>
        </div>

        {/* Add Todo Input */}
        <div className="border-b border-slate-100 dark:border-slate-800">
          <form onSubmit={handleSubmit} className="p-4 flex gap-2">
            <input
              type="text"
              placeholder="Add new task via rpc.todos.add.useMutation()..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isAdding}
              className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            <button
              type="submit"
              // disabled={isAdding || !inputText.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition-colors"
            >
              {isAdding ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              <span>Add</span>
            </button>
            <button
              type="button"
              disabled={isAdding} // this won't work because the onClick is not a react event handler - it's a direct call to the RPC.
              onClick={async () => {
                const [res, err] = await rpc.todos.add({
                  text: "new item",
                });
                if (res) append(res);
                else console.log({ res, err });
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-xs transition-colors"
            >
              Push
            </button>
          </form>
          {error && (
            <div className="p-4 pt-0 flex items-center gap-2">
              <AlertCircle
                size={18}
                className="text-red-600 dark:text-red-400"
              />
              <span className="text-sm text-red-600 dark:text-red-400">
                {error.errors?.text ?? error.message}
              </span>
            </div>
          )}
        </div>

        {/* Todos List */}
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {isTodosLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 size={18} className="animate-spin text-blue-500" />
              <span className="text-sm">Loading todos from router...</span>
            </div>
          ) : todos && todos.length > 0 ? (
            todos.map((todo) => (
              <div
                key={todo.id}
                onClick={() => toggleTodo({ id: todo.id })}
                className="group p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  {todo.completed ? (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  ) : (
                    <Circle
                      size={18}
                      className="text-slate-400 group-hover:text-blue-500 transition-colors"
                    />
                  )}
                  <span
                    className={`text-sm ${
                      todo.completed
                        ? "line-through text-slate-400 dark:text-slate-500"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {todo.text}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  toggle
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-sm text-slate-500">
              No todos yet. Add one above!
            </div>
          )}
        </div>
      </div>

      {/* Code Architecture Explanation */}
      <div className="p-6 rounded-2xl bg-slate-900 text-slate-200 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold text-sm">
          <Code2 size={16} className="text-blue-400" />
          <span>How this works (Next.js App Router + tRPC Parity)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <div className="text-slate-400 font-sans font-semibold text-[11px] uppercase tracking-wider">
              1. Next.js Catch-All Route
            </div>
            <pre className="text-emerald-400 overflow-x-auto">
              {`// app/api/rpc/[...rpc]/route.ts
import { createHandler } from "@explita/actyx-rpc/adapters/next";
import { appRouter } from "@/lib/rpc/router";

export const { GET, POST } = createHandler(appRouter);`}
            </pre>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
            <div className="text-slate-400 font-sans font-semibold text-[11px] uppercase tracking-wider">
              2. Client Proxy SDK Consumption
            </div>
            <pre className="text-blue-400 overflow-x-auto">
              {`// lib/rpc/client.ts
export const rpc = createClient<AppRouter>({
  baseUrl: "/api/rpc",
});

// React component:
const { data } = rpc.todos.list.useQuery();
const { mutate } = rpc.todos.add.useMutation();`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
