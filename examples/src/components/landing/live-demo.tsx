"use client";

import React, { useState } from "react";
import { useQuery, useIsMutating } from "@/dist/react";
import { ping, greet } from "@/lib/rpc/landing";
import {
  Activity,
  RefreshCw,
  Loader2,
  User,
  Send,
  Server,
  Clock,
} from "lucide-react";

export function LiveDemo() {
  const isMutating = useIsMutating();
  const [name, setName] = useState("");

  const {
    data: pingResult,
    isFetching: isPinging,
    refetch: refetchPing,
  } = useQuery(ping, {
    queryKey: ["landing-ping"],
  });

  const {
    data: greetResult,
    isFetching: isGreeting,
    refetch: refetchGreeting,
  } = useQuery(
    () => greet({ name }),
    {
      queryKey: ["landing-greet", name],
      enabled: false,
    },
  );

  const handleGreet = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) refetchGreeting();
  };

  return (
    <section className="py-16 px-4 max-w-6xl mx-auto space-y-12">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          See It In Action
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Clean procedure definitions paired with type-safe client execution.
          Open your browser console to inspect the network calls.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-6 flex flex-col bg-slate-950 rounded-2xl border border-slate-800 dark:border-slate-800 shadow-xl overflow-hidden h-[480px]">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <span className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="text-xs text-slate-400 font-semibold font-mono ml-2">
                procedures.ts
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">
              TypeScript
            </span>
          </div>

          <div className="flex-1 overflow-y-auto text-left select-none nextra-scrollbar bg-slate-950 text-slate-300 p-4 font-mono text-[13px] leading-relaxed whitespace-pre">
            <span className="text-purple-400">import</span><span> </span><span className="text-yellow-300">createProcedure</span><span> </span><span className="text-purple-400">from</span><span> </span><span className="text-green-400">&quot;@explita/actyx-rpc&quot;</span><span>;</span>
{'\n'}
            <span className="text-purple-400">import</span><span> </span><span className="text-yellow-300">z</span><span> </span><span className="text-purple-400">from</span><span> </span><span className="text-green-400">&quot;zod&quot;</span><span>;</span>
{'\n'}
            <span className="text-purple-400">import</span><span> </span><span className="text-yellow-300">zodResolver</span><span> </span><span className="text-purple-400">from</span><span> </span><span className="text-green-400">&quot;@explita/actyx-rpc/resolvers/zod&quot;</span><span>;</span>
{'\n\n'}
            <span className="text-slate-500">// Define a procedure with context</span>
{'\n'}
            <span className="text-purple-400">const</span><span> procedure </span><span className="text-slate-300">=</span><span> createProcedure(</span>
{'\n'}
            <span>  </span><span className="text-slate-500">createContext</span><span className="text-slate-300">:</span><span> </span><span className="text-slate-300">()</span><span> </span><span className="text-slate-300">{'=>'}</span><span> ({'{'}</span>
{'\n'}
            <span>    db, auth</span>
{'\n'}
            <span>  {'}'}),</span>
{'\n'}
            <span>{'}'});</span>
{'\n\n'}
            <span className="text-slate-500">// Type-safe query procedure</span>
{'\n'}
            <span className="text-purple-400">export</span><span> </span><span className="text-purple-400">const</span><span> ping </span><span className="text-slate-300">=</span><span> procedure.query(</span>
{'\n'}
            <span>  </span><span className="text-yellow-300">async</span><span> ({'{'} ctx, input {'}'}) </span><span className="text-slate-300">{'=>'}</span><span> ({'{'}</span>
{'\n'}
            <span>    message</span><span className="text-slate-300">:</span><span> </span><span className="text-green-400">&quot;pong&quot;</span><span>,</span>
{'\n'}
            <span>    serverTime</span><span className="text-slate-300">:</span><span> </span><span className="text-yellow-300">new</span><span> Date().toISOString(),</span>
{'\n'}
            <span>  {'}'}),</span>
{'\n'}
            <span>{'}'});</span>
{'\n\n'}
            <span className="text-slate-500">// With input validation</span>
{'\n'}
            <span className="text-purple-400">export</span><span> </span><span className="text-purple-400">const</span><span> greet </span><span className="text-slate-300">=</span><span> procedure</span>
{'\n'}
            <span>  .input(zodResolver(z.object({'{'}</span>
{'\n'}
            <span>    name</span><span className="text-slate-300">:</span><span> z.string().min(1),</span>
{'\n'}
            <span>  {'}'})))</span>
{'\n'}
            <span>  .query(</span><span className="text-yellow-300">async</span><span> ({'{'} input {'}'}) </span><span className="text-slate-300">{'=>'}</span><span> ({'{'}</span>
{'\n'}
            <span>    greeting</span><span className="text-slate-300">:</span><span> </span><span className="text-green-400">{'`Hello, ${input.name}!`'}</span><span>,</span>
{'\n'}
            <span>    serverTime</span><span className="text-slate-300">:</span><span> </span><span className="text-yellow-300">new</span><span> Date().toISOString(),</span>
{'\n'}
            <span>  {'}'}),</span>
{'\n'}
            <span>{'}'});</span>
          </div>
        </div>

        <div className="lg:col-span-6 flex flex-col justify-between bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-linear-to-r from-blue-500 to-cyan-500" />

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Activity size={18} className="text-blue-500 animate-pulse" />
                Live Actyx RPC Instance
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Execute queries against the server and inspect responses below.
              </p>
              <hr className="border-slate-200 dark:border-slate-800/60 mt-3" />
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Server size={12} className="text-blue-500" />
                    Server Ping
                  </span>
                  <button
                    onClick={() => refetchPing()}
                    disabled={isPinging}
                    className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={12} className={isPinging ? "animate-spin" : ""} />
                    {isPinging ? "Pinging..." : "Refetch"}
                  </button>
                </div>
                    {pingResult ? (
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Message:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        {pingResult.message ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={10} className="text-slate-400" />
                      <span className="text-slate-400">Server:</span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {pingResult.serverTime ?? "—"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    Connecting...
                  </div>
                )}
              </div>

              <form onSubmit={handleGreet} className="space-y-3">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User size={12} className="text-slate-400" />
                  Greeting Demo
                </label>
                <div className="flex gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name..."
                    className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={isGreeting || !name.trim()}
                    className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-500 dark:disabled:text-slate-600 font-medium text-xs rounded-lg px-4 py-2 transition-colors"
                  >
                    {isGreeting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Send size={12} />
                    )}
                    Send
                  </button>
                </div>
                {greetResult && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg p-3 space-y-1 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-blue-500 font-semibold">→</span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {greetResult.greeting ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={10} className="text-slate-400" />
                      <span className="text-slate-400">Server:</span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {greetResult.serverTime ?? "—"}
                      </span>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          <div className="mt-6 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex gap-3 items-start animate-in fade-in duration-300">
            <Activity
              className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0"
              size={16}
            />
            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                End-to-End Type Safety
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-normal">
                Every query flows through the full type pipeline — from the
                procedure definition on the server to the{" "}
                <strong className="text-blue-600 dark:text-blue-400">
                  useQuery
                </strong>{" "}
                hook on the client. Errors are caught at compile time, not
                runtime. Open your DevTools Network tab to inspect the
                underlying HTTP calls.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
