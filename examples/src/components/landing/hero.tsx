"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Terminal, Sparkles } from "lucide-react";
import { VERSION } from "@/dist/version";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24 flex flex-col items-center justify-center text-center px-4">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-linear-to-b from-blue-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none" />

      <div className="absolute -top-10 -left-10 w-72 h-72 bg-blue-300/10 dark:bg-blue-950/20 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-20 right-0 w-80 h-80 bg-teal-300/10 dark:bg-teal-950/20 rounded-full blur-3xl pointer-events-none animate-pulse duration-5000" />

      <div className="relative z-10 max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-linear-to-r from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 border border-blue-200/50 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-semibold select-none shadow-xs">
          <Sparkles
            size={12}
            className="animate-spin-slow text-blue-500 dark:text-blue-400"
          />
          <span>Actyx RPC v{VERSION} is officially here</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-tight sm:leading-none text-slate-900 dark:text-white">
          Type-Safe RPC.
          <span className="block mt-4 bg-clip-text text-transparent bg-linear-to-r from-blue-600 via-cyan-600 to-teal-500 dark:from-blue-400 dark:via-cyan-400 dark:to-teal-400">
            Composable Server Actions.
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-xl text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
          Build server-side procedures with full type safety, minimal
          boilerplate, and a clean, composable API. Bridges client-side queries
          and server-side execution seamlessly.
        </p>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
          <Link
            href="/docs"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl px-7 py-3.5 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <BookOpen size={18} />
            Read Documentation
          </Link>
          <Link
            href="/playground"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700/80 rounded-xl px-7 py-3.5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            <Terminal size={18} />
            Explore Playground
            <ArrowRight
              size={16}
              className="text-slate-400 dark:text-slate-500"
            />
          </Link>
        </div>

        <div className="pt-10 flex flex-wrap items-center justify-center gap-y-4 gap-x-8 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Full Type Inference</span>
          </div>
          <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-250 dark:border-slate-800 pt-2 sm:pt-0 sm:pl-8">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span>Schema-Agnostic Resolvers</span>
          </div>
          <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-slate-250 dark:border-slate-800 pt-2 sm:pt-0 sm:pl-8">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span>Built-in Caching &amp; Retry</span>
          </div>
        </div>
      </div>
    </section>
  );
}
