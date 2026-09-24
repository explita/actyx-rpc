"use client";

import { useState } from "react";
import { rpc } from "@/lib/rpc/client";
import { PlaygroundHeader } from "./header";
import { HealthInspector } from "./health-inspector";
import { BatchingLab } from "./batching-lab";
import { TodosDemo } from "./todos-demo";
import { ArchitectureGuide } from "./architecture-guide";

export function RPCRouterPlaygroundClient() {
  const [lastCall, setLastCall] = useState<string>(
    "SSR Hydrated (Initial Render)",
  );

  // Query todos via proxy SDK - instantly has data from SSR HydrationBoundary!
  const todos = rpc.todos.list.useQuery({
    onSuccess: () => setLastCall("GET /api/rpc/todos.list"),
    unwrap: true,
  });

  // Query health status - instantly has data from SSR HydrationBoundary!
  const { data: health } = rpc.health.useQuery();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <PlaygroundHeader />

      <HealthInspector
        health={health}
        lastCall={lastCall}
        onRefetch={todos.refetch}
        isRefetching={todos.isRefetching}
      />

      <BatchingLab onLogCall={setLastCall} />

      <TodosDemo todos={todos} onLogCall={setLastCall} />

      <ArchitectureGuide />
    </div>
  );
}
