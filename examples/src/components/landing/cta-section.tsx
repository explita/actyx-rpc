"use client";

import React from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { CopyButton } from "../copy-button";

export function CtaSection() {
  return (
    <section className="py-20 px-4 max-w-4xl mx-auto text-center space-y-8">
      <div className="space-y-4">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Ready to Build Type-Safe APIs?
        </h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
          Install, define a procedure, and call it from anywhere. Full type
          safety from server to client.
        </p>
      </div>

      <div className="inline-flex items-center gap-2 bg-slate-950 dark:bg-slate-900 border border-slate-800 rounded-xl px-5 py-3.5 shadow-xl">
        <span className="text-cyan-400 font-mono text-sm font-semibold select-all">
          npm install @explita/actyx-rpc
        </span>
        <CopyButton text="npm install @explita/actyx-rpc" />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link
          href="/docs"
          className="inline-flex items-center justify-center gap-2 bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl px-7 py-3.5 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          <BookOpen size={18} />
          Read Documentation
        </Link>
        <Link
          href="https://github.com/explita/actyx-rpc"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-semibold border border-slate-200 dark:border-slate-700/80 rounded-xl px-7 py-3.5 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          View on GitHub
        </Link>
      </div>
    </section>
  );
}
