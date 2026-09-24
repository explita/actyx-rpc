import { Network, Sparkles } from "lucide-react";

export function PlaygroundHeader() {
  return (
    <div className="mb-8 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 text-xs font-semibold">
          <Network size={13} />
          <span>tRPC Parity Feature</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
          <Sparkles size={13} />
          <span>SSR Hydrated (Zero Loading Flash)</span>
        </div>
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        tRPC-Style Catch-All Router + SSR Hydration
      </h1>
      <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
        Demonstrates full tRPC-style path routing using a Next.js App Router
        catch-all route{" "}
        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-blue-600 dark:text-blue-400">
          app/api/rpc/[[...rpc]]/route.ts
        </code>{" "}
        prefetched in a Server Component with{" "}
        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-emerald-600 dark:text-emerald-400">
          queryClient.prefetchQuery
        </code>{" "}
        and hydrated to client components with zero loading flicker via{" "}
        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-purple-600 dark:text-purple-400">
          &lt;HydrationBoundary&gt;
        </code>
        .
      </p>
    </div>
  );
}
