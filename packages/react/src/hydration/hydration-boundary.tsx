"use client";

import React, { useRef } from "react";
import { useQueryClient } from "../provider.js";
import type { QueryClient } from "../lib/query-client.js";
import type { DehydratedState, HydrateOptions } from "../types/query-client.js";

export type {
  DehydratedState,
  HydrateOptions,
  DehydrateOptions,
  DehydratedQuery,
  DehydratedMutation,
} from "../types/query-client.js";

/**
 * Hook to hydrate dehydrated state into the QueryClient cache synchronously during render.
 *
 * @param state Dehydrated state snapshot from `queryClient.dehydrate()` or `dehydrate(queryClient)`.
 * @param options Optional hydration configuration.
 * @param explicitClient Optional explicit QueryClient instance.
 */
export function useHydrate(
  state?: DehydratedState | null,
  options?: HydrateOptions,
  explicitClient?: QueryClient,
): void {
  const client = useQueryClient(explicitClient);
  const hydratedRef = useRef<DehydratedState | null>(null);

  if (state && hydratedRef.current !== state) {
    client.hydrate(state, options);
    hydratedRef.current = state;
  }
}

export interface HydrationBoundaryProps {
  /**
   * The dehydrated state produced by `queryClient.dehydrate()` or `dehydrate(queryClient)`.
   */
  state?: DehydratedState | null;

  /**
   * Optional hydration options (e.g. default staleTime for hydrated queries).
   */
  options?: HydrateOptions;

  /**
   * Optional explicit QueryClient to hydrate into instead of the context client.
   */
  client?: QueryClient;

  /**
   * Child components that will have instant zero-flash access to hydrated query data.
   */
  children?: React.ReactNode;
}

/**
 * Hydrates dehydrated query state into the QueryClient cache during render.
 * Allows Server Components to prefetch data that Client Components can immediately
 * access via `useQuery()` with zero loading flash or skeleton flicker.
 *
 * @example
 * ```tsx
 * // app/todos/page.tsx (Server Component)
 * const queryClient = new QueryClient();
 * await queryClient.prefetchQuery(["todos", "list"], () => appRouter.todos.list());
 *
 * return (
 *   <HydrationBoundary state={queryClient.dehydrate()}>
 *     <TodoListClient />
 *   </HydrationBoundary>
 * );
 * ```
 */
export function HydrationBoundary({
  state,
  options,
  client,
  children,
}: HydrationBoundaryProps) {
  useHydrate(state, options, client);
  return <>{children}</>;
}
