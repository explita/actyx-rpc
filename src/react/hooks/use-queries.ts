import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  useMemo,
} from "react";
import { useQueryClient } from "../provider.js";
import { globalRequestManager } from "../lib/request-manager.js";
import { QueriesResults, UseQueriesQueryConfig } from "../types.js";
import { ErrorResponse } from "../../types/misc.js";

export function useQueries<T extends readonly UseQueriesQueryConfig[]>(
  queries: T,
): QueriesResults<T> {
  const queryClient = useQueryClient();

  // 1. Keep track of current query keys to avoid unnecessary resubscriptions
  const keysRef = useRef<string[]>([]);
  const keysStr = queries
    .map((q) => q.queryKey.map(String).join("|"))
    .join(",");
  const stableKeys = useMemo(() => {
    const keys = queries.map((q) => q.queryKey.map(String).join("|"));
    const changed =
      keys.length !== keysRef.current.length ||
      keys.some((k, i) => k !== keysRef.current[i]);
    if (changed) {
      keysRef.current = keys;
    }
    return keysRef.current;
  }, [keysStr]);

  // 2. Keep a ref of callbacks and configurations
  const configsRef = useRef(queries);
  useEffect(() => {
    configsRef.current = queries;
  });

  // 3. Ensure initial states exist in the cache
  queries.forEach((q, index) => {
    const queryKey = stableKeys[index];
    if (!queryClient.getQueryState(queryKey)) {
      queryClient.setQueryState(
        queryKey,
        {
          data: q.initialData,
          error: undefined,
          isFetching: false,
          isError: false,
          isSuccess: q.initialData !== undefined,
        },
        { silent: true },
      );
    }
  });

  // 4. Set up the subscription store change listener
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubs = queries.map((q, index) => {
        const queryKey = stableKeys[index];
        return queryClient.subscribe(queryKey, onStoreChange, q.gcTime);
      });
      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    },
    [queryClient, stableKeys],
  );

  // 5. Get snapshot of all states
  const getSnapshot = useCallback(() => {
    return stableKeys.map((key) => queryClient.getQueryState(key)!);
  }, [queryClient, stableKeys]);

  const states = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // 6. Fetch data using Promise.all
  const fetchAll = useCallback(async () => {
    const promises = configsRef.current.map(async (q, index) => {
      const queryKey = stableKeys[index];
      if (q.enabled === false) return;

      const state = queryClient.getQueryState(queryKey);
      const staleTime = q.staleTime ?? 0;
      const refetchOnMount = q.refetchOnMount ?? true;

      let shouldFetch = true;

      if (state?.isSuccess && state?.updatedAt) {
        if (refetchOnMount === false) {
          shouldFetch = false;
        } else if (refetchOnMount !== "always") {
          const isStale = Date.now() - state.updatedAt >= staleTime;
          if (!isStale) {
            shouldFetch = false;
          }
        }
      }

      if (!shouldFetch) return;

      queryClient.setQueryState(queryKey, { isFetching: true });

      const fetcher = async () => await q.proc();
      let resultTuple: [any, null] | [null, ErrorResponse];

      if (!queryKey.startsWith("__local__")) {
        resultTuple = await globalRequestManager.fetch(queryKey, fetcher);
      } else {
        resultTuple = await fetcher();
      }

      const [result, err] = resultTuple;

      if (err) {
        queryClient.setQueryState(queryKey, {
          error: err,
          isError: true,
          isSuccess: false,
          isFetching: false,
          data: q.initialData,
        });
        q.onError?.(err);
      } else {
        const unwrapped =
          (q.unwrap as any) === true &&
          result &&
          typeof result === "object" &&
          "data" in result
            ? (result as any).data
            : result;

        queryClient.setQueryState(queryKey, {
          data: unwrapped,
          error: undefined,
          isError: false,
          isSuccess: true,
          isFetching: false,
          updatedAt: Date.now(),
        });

        const finalData = q.select ? q.select(unwrapped) : unwrapped;
        q.onSuccess?.(finalData);
        q.onSettled?.(finalData, null);
      }

      if (err) {
        q.onSettled?.(null, err);
      }
    });

    await Promise.all(promises);
  }, [stableKeys, queryClient]);

  // Initial fetch effect
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 7. Map states to QueryResults format
  return useMemo(() => {
    return states.map((state, index) => {
      const q = configsRef.current[index];
      const queryKey = stableKeys[index];

      const refetch = async () => {
        queryClient.setQueryState(queryKey, { isFetching: true });
        const fetcher = async () => await configsRef.current[index].proc();
        let resultTuple: [any, null] | [null, ErrorResponse];

        if (!queryKey.startsWith("__local__")) {
          resultTuple = await globalRequestManager.fetch(queryKey, fetcher);
        } else {
          resultTuple = await fetcher();
        }

        const [result, err] = resultTuple;
        if (err) {
          queryClient.setQueryState(queryKey, {
            error: err,
            isError: true,
            isSuccess: false,
            isFetching: false,
            data: configsRef.current[index].initialData,
          });
          configsRef.current[index].onError?.(err);
          configsRef.current[index].onSettled?.(null, err);
        } else {
          const unwrapped =
            (configsRef.current[index].unwrap as any) === true &&
            result &&
            typeof result === "object" &&
            "data" in result
              ? result.data
              : result;

          queryClient.setQueryState(queryKey, {
            data: unwrapped,
            error: undefined,
            isError: false,
            isSuccess: true,
            isFetching: false,
            updatedAt: Date.now(),
          });
          const finalData = configsRef.current[index].select
            ? configsRef.current[index].select!(unwrapped)
            : unwrapped;
          configsRef.current[index].onSuccess?.(finalData);
          configsRef.current[index].onSettled?.(finalData, null);
        }
        return result;
      };

      const reset = () => {
        queryClient.setQueryState(queryKey, {
          data: configsRef.current[index].initialData,
          error: undefined,
          isFetching: false,
          isError: false,
          isSuccess: configsRef.current[index].initialData !== undefined,
        });
      };

      const isRefetching = state.isFetching && state.data !== undefined;
      const data = state.data;
      const selectedData =
        data !== undefined && q?.select ? q.select(data) : data;

      return {
        error: state.error,
        isFetching: state.isFetching,
        isRefetching,
        isError: state.isError,
        isSuccess: state.isSuccess,
        refetch,
        reset,
        data: selectedData,
      };
    }) as unknown as QueriesResults<T>;
  }, [states, stableKeys, queryClient]);
}
