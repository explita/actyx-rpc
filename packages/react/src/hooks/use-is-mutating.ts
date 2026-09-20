import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "../provider.js";

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
