"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "../provider.js";

/**
 * React hook that returns whether any mutations are currently in-flight.
 *
 * Can optionally filter by a specific `mutationKey` to observe only matching mutations.
 *
 * @template T - Type of the mutation key or key array.
 * @param mutationKey - Optional mutation key or array of key segments to filter active mutations by.
 * @returns A boolean indicating whether at least one matching mutation is actively executing.
 *
 * @example
 * ```tsx
 * const isMutating = useIsMutating(); // Global mutation spinner
 * const isSavingPost = useIsMutating(["posts", "save"]);
 * ```
 */
export function useIsMutating<T extends unknown = unknown>(
  mutationKey?: T | T[],
): boolean {
  const queryClient = useQueryClient();

  const normalizedKey =
    mutationKey !== undefined
      ? Array.isArray(mutationKey)
        ? mutationKey
        : [mutationKey]
      : undefined;

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      queryClient.subscribeMutations(onStoreChange),
    [queryClient],
  );

  const getSnapshot = useCallback(() => {
    return queryClient.isMutating(normalizedKey);
  }, [
    queryClient,
    normalizedKey ? normalizedKey.map(String).join("|") : undefined,
  ]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
