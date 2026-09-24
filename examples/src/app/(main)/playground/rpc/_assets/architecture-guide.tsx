import { Code2 } from "lucide-react";

export function ArchitectureGuide() {
  return (
    <div className="p-6 rounded-2xl bg-slate-900 text-slate-200 border border-slate-800 space-y-4">
      <div className="flex items-center gap-2 text-white font-semibold text-sm">
        <Code2 size={16} className="text-blue-400" />
        <span>How this works (Next.js App Router + SSR Hydration)</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <div className="text-slate-400 font-sans font-semibold text-[11px] uppercase tracking-wider">
            1. Server Component Prefetch (app/playground/rpc/page.tsx)
          </div>
          <pre className="text-emerald-400 overflow-x-auto">
            {`// Server Component
const queryClient = new QueryClient();
await queryClient.prefetchQuery(
  ["todos", "list"],
  () => appRouter.todos.list()
);

return (
  <HydrationBoundary state={queryClient.dehydrate()}>
    <RPCRouterPlaygroundClient />
  </HydrationBoundary>
);`}
          </pre>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
          <div className="text-slate-400 font-sans font-semibold text-[11px] uppercase tracking-wider">
            2. Client Component (Zero-Flash useQuery)
          </div>
          <pre className="text-blue-400 overflow-x-auto">
            {`// Client Component:
// Instant cache hit on frame 0, zero loading spinner!
const todos = rpc.todos.list.useQuery({
  unwrap: true,
});

const { mutate } = rpc.todos.add.useMutation();`}
          </pre>
        </div>
      </div>
    </div>
  );
}
