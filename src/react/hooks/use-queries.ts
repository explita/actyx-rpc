import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  useMemo,
} from "react";
import { useQueryClient } from "../provider.js";
import { globalRequestManager } from "../lib/request-manager.js";
import { QueriesResults, UseQueriesConfig } from "../types.js";
import { ErrorResponse } from "../../types/misc.js";
import { parseWindow } from "../../lib/utils.js";

export function useQueries<T extends UseQueriesConfig[]>(
  ...queries: T
): QueriesResults<T> {
  const queryClient = useQueryClient();

  // 1. Keep track of current query keys to avoid unnecessary resubscriptions
  const keysRef = useRef<string[]>([]);
  const keysStr = queries
    .map((q) => q.queryKey?.map(String).join("|"))
    .join(",");
  const stableKeys = useMemo(() => {
    const keys = queries.map((q) => (q.queryKey || []).map(String).join("|"));
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
  const keepPrevRef = useRef<boolean[]>([]);
  useEffect(() => {
    configsRef.current = queries;
    keepPrevRef.current = queries.map((q) => q.keepPreviousData ?? true);
  });

  // 3. Ensure initial states exist in the cache
  queries.forEach((q, index) => {
    const queryKey = stableKeys[index];
    if (!queryClient.getQueryState(queryKey)) {
      const resolvedInitialData =
        typeof q.initialData === "function" ? q.initialData() : q.initialData;
      queryClient.setQueryState(
        queryKey,
        {
          data: resolvedInitialData,
          error: undefined,
          isFetching: false,
          isError: false,
          isSuccess: resolvedInitialData !== undefined,
          updatedAt: resolvedInitialData !== undefined ? Date.now() : undefined,
          isFetched: false,
        },
        { silent: true },
      );
    }
  });

  // 4. Cache snapshot to avoid infinite loop warning from useSyncExternalStore
  const cachedSnapshotRef = useRef<any[]>([]);
  const stableKeysRef = useRef(stableKeys);
  stableKeysRef.current = stableKeys;

  const refreshSnapshot = () => {
    cachedSnapshotRef.current = stableKeysRef.current.map(
      (key) => queryClient.getQueryState(key)!,
    );
  };

  // 5. Set up the subscription store change listener
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      refreshSnapshot();
      const keys = stableKeysRef.current;
      const unsubs = configsRef.current.map((q, index) => {
        const queryKey = keys[index];
        return queryClient.subscribe(
          queryKey,
          () => {
            refreshSnapshot();
            onStoreChange();
          },
          q.gcTime,
        );
      });
      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    },
    [queryClient],
  );

  // 6. Get snapshot of all states (referentially stable via cachedSnapshotRef)
  const getSnapshot = useCallback(() => {
    if (cachedSnapshotRef.current.length === 0) {
      refreshSnapshot();
    }
    return cachedSnapshotRef.current;
  }, [queryClient]);

  const states = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // 6. Fetch data using Promise.all
  const fetchAll = useCallback(async () => {
    const promises = configsRef.current.map(async (q, index) => {
      const queryKey = stableKeysRef.current[index];
      if (q.enabled === false) return;

      const state = queryClient.getQueryState(queryKey);
      const staleTime = parseWindow(q.staleTime);
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

      queryClient.setQueryState(queryKey, {
        isFetching: true,
        ...(keepPrevRef.current[index] === false && { data: undefined }),
      });

      const fetcher = async () => await q.proc();
      let resultTuple: [any, null] | [null, ErrorResponse];

      if (!queryKey.startsWith("__local__")) {
        resultTuple = await globalRequestManager.fetch(queryKey, fetcher);
      } else {
        resultTuple = await fetcher();
      }

      const [result, err] = resultTuple;

      if (err) {
        const initData = configsRef.current[index].initialData;
        const resolvedInitData =
          typeof initData === "function" ? initData() : initData;
        queryClient.setQueryState(queryKey, {
          error: err,
          isError: true,
          isSuccess: false,
          isFetching: false,
          data: resolvedInitData,
          isFetched: true,
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
          isFetched: true,
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
  }, [queryClient]);

  // Initial fetch effect
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refetch on window focus
  useEffect(() => {
    let active = true;

    const refetchableIndices = stableKeys
      .map((_, i) => i)
      .filter((i) => configsRef.current[i]?.refetchOnWindowFocus);

    if (refetchableIndices.length === 0) return;

    const handleFocus = () => {
      if (!active) return;
      refetchableIndices.forEach((i) => {
        const q = configsRef.current[i];
        const key = stableKeys[i];
        const state = queryClient.getQueryState(key);
        if (!state || q.enabled === false) return;

        // Skip if data is still fresh
        const staleTime = parseWindow(q.staleTime);
        if (
          state.isSuccess &&
          state.updatedAt &&
          Date.now() - state.updatedAt < staleTime
        )
          return;

        queryClient.setQueryState(key, {
          isFetching: true,
          ...((q.keepPreviousData ?? true) === false && {
            data: undefined,
          }),
        });

        const fetcher = async () => await q.proc();
        globalRequestManager.fetch(key, fetcher).then(([result, err]) => {
          if (!active) return;
          if (err) {
            queryClient.setQueryState(key, {
              error: err,
              isError: true,
              isSuccess: false,
              isFetching: false,
              isFetched: true,
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
            queryClient.setQueryState(key, {
              data: unwrapped,
              error: undefined,
              isError: false,
              isSuccess: true,
              isFetching: false,
              updatedAt: Date.now(),
              isFetched: true,
            });
            const finalData = q.select ? q.select(unwrapped) : unwrapped;
            q.onSuccess?.(finalData);
            q.onSettled?.(finalData, null);
          }
        });
      });
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, [queryClient, stableKeys]);

  // Refetch on network reconnect
  useEffect(() => {
    let active = true;

    const refetchableIndices = stableKeys
      .map((_, i) => i)
      .filter((i) => configsRef.current[i]?.refetchOnReconnect ?? true);

    if (refetchableIndices.length === 0) return;

    const handleOnline = () => {
      if (!active) return;
      refetchableIndices.forEach((i) => {
        const q = configsRef.current[i];
        const key = stableKeys[i];
        const state = queryClient.getQueryState(key);
        if (!state || q.enabled === false) return;

        const staleTime = parseWindow(q.staleTime);
        if (
          q.refetchOnReconnect !== "always" &&
          state.updatedAt &&
          Date.now() - state.updatedAt < staleTime
        )
          return;

        queryClient.setQueryState(key, {
          isFetching: true,
          ...((q.keepPreviousData ?? true) === false && {
            data: undefined,
          }),
        });

        const fetcher = async () => await q.proc();
        globalRequestManager.fetch(key, fetcher).then(([result, err]) => {
          if (!active) return;
          if (err) {
            queryClient.setQueryState(key, {
              error: err,
              isError: true,
              isSuccess: false,
              isFetching: false,
              isFetched: true,
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
            queryClient.setQueryState(key, {
              data: unwrapped,
              error: undefined,
              isError: false,
              isSuccess: true,
              isFetching: false,
              updatedAt: Date.now(),
              isFetched: true,
            });
            const finalData = q.select ? q.select(unwrapped) : unwrapped;
            q.onSuccess?.(finalData);
            q.onSettled?.(finalData, null);
          }
        });
      });
    };

    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
    };
  }, [queryClient, stableKeys]);

  // 7. Map states to QueryResults format
  return useMemo(() => {
    return states.map((state, index) => {
      const q = configsRef.current[index];
      const queryKey = stableKeys[index];

      const refetch = async () => {
        queryClient.setQueryState(queryKey, {
          isFetching: true,
          ...(keepPrevRef.current[index] === false && { data: undefined }),
        });
        const fetcher = async () => await configsRef.current[index].proc();
        let resultTuple: [any, null] | [null, ErrorResponse];

        if (!queryKey.startsWith("__local__")) {
          resultTuple = await globalRequestManager.fetch(queryKey, fetcher);
        } else {
          resultTuple = await fetcher();
        }

        const [result, err] = resultTuple;
        if (err) {
          const initData = configsRef.current[index].initialData;
          const resolvedInitData =
            typeof initData === "function" ? initData() : initData;
          queryClient.setQueryState(queryKey, {
            error: err,
            isError: true,
            isSuccess: false,
            isFetching: false,
            data: resolvedInitData,
            isFetched: true,
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
            isFetched: true,
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
        const initData = configsRef.current[index].initialData;
        const resolvedInitData =
          typeof initData === "function" ? initData() : initData;
        queryClient.setQueryState(queryKey, {
          data: resolvedInitData,
          error: undefined,
          isFetching: false,
          isError: false,
          isSuccess: resolvedInitData !== undefined,
          updatedAt: resolvedInitData !== undefined ? Date.now() : undefined,
          isFetched: false,
        });
      };

      const isRefetching = state.isFetching && state.data !== undefined;
      const data = state.data;
      const selectedData =
        data !== undefined && q?.select ? q.select(data) : data;

      const isEmpty =
        state.isFetched &&
        (selectedData === null ||
          selectedData === undefined ||
          (Array.isArray(selectedData) && selectedData.length === 0));

      return {
        error: state.error,
        isFetching: state.isFetching,
        isRefetching,
        isError: state.isError,
        isSuccess: state.isSuccess,
        isFetched: state.isFetched,
        isEmpty,
        refetch,
        reset,
        data: selectedData,
      };
    }) as unknown as QueriesResults<T>;
  }, [states, stableKeys, queryClient]);
}
