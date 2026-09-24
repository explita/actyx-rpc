import { QueryClient, HydrationBoundary } from "@/dist/react";
import { appRouter } from "@/lib/rpc/router";
import { RPCRouterPlaygroundClient } from "./_assets/rpc-playground-client";

export default async function RPCRouterPlaygroundPage() {
  const queryClient = new QueryClient();

  // Prefetch data on the server with smart unwrapping & deduplication
  await Promise.all([
    queryClient.prefetchQuery(["todos", "list"], async () => {
      const [res] = await appRouter.todos.list();
      return res?.data || [];
    }),
    queryClient.prefetchQuery(["health"], () => appRouter.health()),
  ]);

  return (
    <HydrationBoundary state={queryClient.dehydrate()}>
      <RPCRouterPlaygroundClient />
    </HydrationBoundary>
  );
}
