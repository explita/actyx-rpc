"use client";

import React from "react";
import {
  Shield,
  Cpu,
  Zap,
  Activity,
  RefreshCw,
  Codepen,
} from "lucide-react";

const FEATURES_LIST = [
  {
    icon: <Cpu className="text-blue-600 dark:text-blue-400" size={24} />,
    title: "Type-Safe Procedures",
    description: "Define server actions with full type inference from server to client. Input validation, context injection, and typed outputs — all inferred automatically.",
    color: "from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5 border-blue-100 dark:border-blue-500/10"
  },
  {
    icon: <Codepen className="text-emerald-600 dark:text-emerald-400" size={24} />,
    title: "Schema-Agnostic Resolvers",
    description: "Bring your own validation library. Supports Zod, Valibot, ArkType, Joi, and Yup out of the box with a clean resolver interface.",
    color: "from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/5 dark:to-teal-500/5 border-emerald-100 dark:border-emerald-500/10"
  },
  {
    icon: <Zap className="text-indigo-600 dark:text-indigo-400" size={24} />,
    title: "Built-in Caching",
    description: "Pluggable cache adapters including MemoryCache and RedisCache with configurable TTL, max size, and automatic invalidation strategies.",
    color: "from-indigo-500/10 to-cyan-500/10 dark:from-indigo-500/5 dark:to-cyan-500/5 border-indigo-100 dark:border-indigo-500/10"
  },
  {
    icon: <Activity className="text-fuchsia-600 dark:text-fuchsia-400" size={24} />,
    title: "Real-Time SSE",
    description: "Stream server-sent events directly to the client with automatic reconnection. Perfect for live data feeds, notifications, and progress updates.",
    color: "from-fuchsia-500/10 to-pink-500/10 dark:from-fuchsia-500/5 dark:to-pink-500/5 border-fuchsia-100 dark:border-fuchsia-500/10"
  },
  {
    icon: <RefreshCw className="text-amber-600 dark:text-amber-400" size={24} />,
    title: "Resilience Layer",
    description: "Automatic retries with configurable backoff, circuit breaker pattern, request timeouts, and response compression for production-grade reliability.",
    color: "from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5 border-amber-100 dark:border-amber-500/10"
  },
  {
    icon: <Shield className="text-rose-600 dark:text-rose-400" size={24} />,
    title: "React Integration",
    description: "First-class React hooks including useQuery, useMutation, useSuspenseQuery, useInfiniteQuery, and SSE subscriptions with Suspense support.",
    color: "from-rose-500/10 to-purple-500/10 dark:from-rose-500/5 dark:to-purple-500/5 border-rose-100 dark:border-rose-500/10"
  }
];

export function Features() {
  return (
    <section className="py-16 px-4 max-w-6xl mx-auto space-y-12">
      <div className="text-center space-y-3">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Built for Production Type-Safety
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed">
          Actyx RPC eliminates boilerplate and bridges the gap between client
          and server with full end-to-end type safety.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES_LIST.map((feat, index) => (
          <div
            key={index}
            className={`group relative overflow-hidden bg-white dark:bg-slate-900/40 border ${feat.color} rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-blue-500/20 dark:hover:border-blue-500/30 transition-all duration-300 hover:-translate-y-1`}
          >
            <div className="mb-4 inline-flex items-center justify-center p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 group-hover:scale-110 transition-transform duration-300">
              {feat.icon}
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200 mb-2">
              {feat.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {feat.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
