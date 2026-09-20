import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "../provider.js";

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
