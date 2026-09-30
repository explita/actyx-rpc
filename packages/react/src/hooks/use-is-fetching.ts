"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "../provider.js";

/**
 * React hook that returns whether any queries are currently in-flight.
 *
 * Can optionally filter by a specific `queryKey` or key prefix to observe only matching queries.
 *
 * @template T - Type of the query key or key array.
 * @param queryKey - Optional query key or array of key segments to filter active queries by.
 * @returns A boolean indicating whether at least one matching query is actively fetching.
 *
 * @example
 * ```tsx
 * const isFetching = useIsFetching(); // Global loading indicator
 * const isUsersFetching = useIsFetching(["users"]); // Specific to users queries
 * ```
 */
export function useIsFetching<T extends unknown = unknown>(
  queryKey?: T | T[],
): boolean {
  const queryClient = useQueryClient();

  const normalizedKey =
    queryKey !== undefined
      ? Array.isArray(queryKey)
        ? queryKey.map(String).join("|")
        : String(queryKey)
      : undefined;

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      queryClient.subscribeAll(onStoreChange),
    [queryClient],
  );

  const getSnapshot = useCallback(() => {
    return queryClient.isFetching(normalizedKey);
  }, [queryClient, normalizedKey]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
