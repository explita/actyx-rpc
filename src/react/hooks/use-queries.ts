import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  useMemo,
} from "react";
import { useQueryClient } from "../provider.js";
import { globalRequestManager } from "../lib/request-manager.js";
import {
  QueriesResults,
  QueryData,
  QueryResult,
  Unwrap,
  UseQueriesItem,
} from "../types.js";
import { ErrorResponse } from "../../types/misc.js";
import { parseWindow } from "../../lib/utils.js";
import { QueryState } from "../lib/query-client.js";

/**
 * `useQueries` — fetch multiple independent queries at once, with per-item
 * type inference (TanStack-inspired structural approach).
 *
 * Each item is mapped independently so that `unwrap`, `select`, and
 * `initialData` work exactly like they do in `useQuery`.
 */
// 1 query
export function useQueries<
  T1Output,
  T1QueryKey extends unknown[] = unknown[],
  T1Unwrap extends boolean = false,
  T1SelectData = Unwrap<T1Output, T1Unwrap>,
  T1InitialData extends QueryData<Unwrap<T1Output, T1Unwrap>> | undefined =
    undefined,
>(
  q1: UseQueriesItem<
    T1Output,
    T1QueryKey,
    T1Unwrap,
    T1SelectData,
    T1InitialData
  >,
): [QueryResult<T1Output, T1InitialData, T1Unwrap, T1SelectData>];

// 2 queries
export function useQueries<
  T1Output,
  T1QueryKey extends unknown[] = unknown[],
  T1Unwrap extends boolean = false,
  T1SelectData = Unwrap<T1Output, T1Unwrap>,
  T1InitialData extends QueryData<Unwrap<T1Output, T1Unwrap>> | undefined =
    undefined,
  T2Output = any,
  T2QueryKey extends unknown[] = unknown[],
  T2Unwrap extends boolean = false,
  T2SelectData = Unwrap<T2Output, T2Unwrap>,
  T2InitialData extends QueryData<Unwrap<T2Output, T2Unwrap>> | undefined =
    undefined,
>(
  q1: UseQueriesItem<
    T1Output,
    T1QueryKey,
    T1Unwrap,
    T1SelectData,
    T1InitialData
  >,
  q2: UseQueriesItem<
    T2Output,
    T2QueryKey,
    T2Unwrap,
    T2SelectData,
    T2InitialData
  >,
): [
  QueryResult<T1Output, T1InitialData, T1Unwrap, T1SelectData>,
  QueryResult<T2Output, T2InitialData, T2Unwrap, T2SelectData>,
];

// 3 queries
export function useQueries<
  T1Output,
  T1QueryKey extends unknown[] = unknown[],
  T1Unwrap extends boolean = false,
  T1SelectData = Unwrap<T1Output, T1Unwrap>,
  T1InitialData extends QueryData<Unwrap<T1Output, T1Unwrap>> | undefined =
    undefined,
  T2Output = any,
  T2QueryKey extends unknown[] = unknown[],
  T2Unwrap extends boolean = false,
  T2SelectData = Unwrap<T2Output, T2Unwrap>,
  T2InitialData extends QueryData<Unwrap<T2Output, T2Unwrap>> | undefined =
    undefined,
  T3Output = any,
  T3QueryKey extends unknown[] = unknown[],
  T3Unwrap extends boolean = false,
  T3SelectData = Unwrap<T3Output, T3Unwrap>,
  T3InitialData extends QueryData<Unwrap<T3Output, T3Unwrap>> | undefined =
    undefined,
>(
  q1: UseQueriesItem<
    T1Output,
    T1QueryKey,
    T1Unwrap,
    T1SelectData,
    T1InitialData
  >,
  q2: UseQueriesItem<
    T2Output,
    T2QueryKey,
    T2Unwrap,
    T2SelectData,
    T2InitialData
  >,
  q3: UseQueriesItem<
    T3Output,
    T3QueryKey,
    T3Unwrap,
    T3SelectData,
    T3InitialData
  >,
): [
  QueryResult<T1Output, T1InitialData, T1Unwrap, T1SelectData>,
  QueryResult<T2Output, T2InitialData, T2Unwrap, T2SelectData>,
  QueryResult<T3Output, T3InitialData, T3Unwrap, T3SelectData>,
];

// 4 queries
export function useQueries<
  T1Output,
  T1QueryKey extends unknown[] = unknown[],
  T1Unwrap extends boolean = false,
  T1SelectData = Unwrap<T1Output, T1Unwrap>,
  T1InitialData extends QueryData<Unwrap<T1Output, T1Unwrap>> | undefined =
    undefined,
  T2Output = any,
  T2QueryKey extends unknown[] = unknown[],
  T2Unwrap extends boolean = false,
  T2SelectData = Unwrap<T2Output, T2Unwrap>,
  T2InitialData extends QueryData<Unwrap<T2Output, T2Unwrap>> | undefined =
    undefined,
  T3Output = any,
  T3QueryKey extends unknown[] = unknown[],
  T3Unwrap extends boolean = false,
  T3SelectData = Unwrap<T3Output, T3Unwrap>,
  T3InitialData extends QueryData<Unwrap<T3Output, T3Unwrap>> | undefined =
    undefined,
  T4Output = any,
  T4QueryKey extends unknown[] = unknown[],
  T4Unwrap extends boolean = false,
  T4SelectData = Unwrap<T4Output, T4Unwrap>,
  T4InitialData extends QueryData<Unwrap<T4Output, T4Unwrap>> | undefined =
    undefined,
>(
  q1: UseQueriesItem<
    T1Output,
    T1QueryKey,
    T1Unwrap,
    T1SelectData,
    T1InitialData
  >,
  q2: UseQueriesItem<
    T2Output,
    T2QueryKey,
    T2Unwrap,
    T2SelectData,
    T2InitialData
  >,
  q3: UseQueriesItem<
    T3Output,
    T3QueryKey,
    T3Unwrap,
    T3SelectData,
    T3InitialData
  >,
  q4: UseQueriesItem<
    T4Output,
    T4QueryKey,
    T4Unwrap,
    T4SelectData,
    T4InitialData
  >,
): [
  QueryResult<T1Output, T1InitialData, T1Unwrap, T1SelectData>,
  QueryResult<T2Output, T2InitialData, T2Unwrap, T2SelectData>,
  QueryResult<T3Output, T3InitialData, T3Unwrap, T3SelectData>,
  QueryResult<T4Output, T4InitialData, T4Unwrap, T4SelectData>,
];

// 5 queries
export function useQueries<
  T1Output,
  T1QueryKey extends unknown[] = unknown[],
  T1Unwrap extends boolean = false,
  T1SelectData = Unwrap<T1Output, T1Unwrap>,
  T1InitialData extends QueryData<Unwrap<T1Output, T1Unwrap>> | undefined =
    undefined,
  T2Output = any,
  T2QueryKey extends unknown[] = unknown[],
  T2Unwrap extends boolean = false,
  T2SelectData = Unwrap<T2Output, T2Unwrap>,
  T2InitialData extends QueryData<Unwrap<T2Output, T2Unwrap>> | undefined =
    undefined,
  T3Output = any,
  T3QueryKey extends unknown[] = unknown[],
  T3Unwrap extends boolean = false,
  T3SelectData = Unwrap<T3Output, T3Unwrap>,
  T3InitialData extends QueryData<Unwrap<T3Output, T3Unwrap>> | undefined =
    undefined,
  T4Output = any,
  T4QueryKey extends unknown[] = unknown[],
  T4Unwrap extends boolean = false,
  T4SelectData = Unwrap<T4Output, T4Unwrap>,
  T4InitialData extends QueryData<Unwrap<T4Output, T4Unwrap>> | undefined =
    undefined,
  T5Output = any,
  T5QueryKey extends unknown[] = unknown[],
  T5Unwrap extends boolean = false,
  T5SelectData = Unwrap<T5Output, T5Unwrap>,
  T5InitialData extends QueryData<Unwrap<T5Output, T5Unwrap>> | undefined =
    undefined,
>(
  q1: UseQueriesItem<
    T1Output,
    T1QueryKey,
    T1Unwrap,
    T1SelectData,
    T1InitialData
  >,
  q2: UseQueriesItem<
    T2Output,
    T2QueryKey,
    T2Unwrap,
    T2SelectData,
    T2InitialData
  >,
  q3: UseQueriesItem<
    T3Output,
    T3QueryKey,
    T3Unwrap,
    T3SelectData,
    T3InitialData
  >,
  q4: UseQueriesItem<
    T4Output,
    T4QueryKey,
    T4Unwrap,
    T4SelectData,
    T4InitialData
  >,
  q5: UseQueriesItem<
    T5Output,
    T5QueryKey,
    T5Unwrap,
    T5SelectData,
    T5InitialData
  >,
): [
  QueryResult<T1Output, T1InitialData, T1Unwrap, T1SelectData>,
  QueryResult<T2Output, T2InitialData, T2Unwrap, T2SelectData>,
  QueryResult<T3Output, T3InitialData, T3Unwrap, T3SelectData>,
  QueryResult<T4Output, T4InitialData, T4Unwrap, T4SelectData>,
  QueryResult<T5Output, T5InitialData, T5Unwrap, T5SelectData>,
];

// Fallback variadic
export function useQueries<
  T extends readonly UseQueriesItem<any, any, any, any, any>[],
>(...queries: [...T]): QueriesResults<T>;
export function useQueries(
  ...queries: UseQueriesItem<any, any, any, any, any>[]
) {
  const queryClient = useQueryClient();

  // 1. Stable query keys
  const keysStr = queries
    .map((q) => q.queryKey?.map(String).join("|"))
    .join(",");
  const keysRef = useRef<string[]>([]);
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

  // Keep a mutable ref to stableKeys for use inside callbacks/effects
  const stableKeysRef = useRef(stableKeys);
  stableKeysRef.current = stableKeys;

  // 2. Sync configs during render (not in useEffect) so fetchAll sees latest values
  const configsRef = useRef(queries);
  configsRef.current = queries;

  // 3. Per-query race protection
  const generationRef = useRef(new Map<string, number>());
  const fetchingRef = useRef(new Set<string>());

  // 4. Ensure initial states exist in cache before subscribing
  queries.forEach((q, index) => {
    const queryKey = stableKeys[index];
    if (!queryClient.getQueryState(queryKey)) {
      const resolvedInitialData =
        //@ts-ignore
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

  // 5. Snapshot cache for referential stability in useSyncExternalStore
  const snapshotRef = useRef<QueryState<any, any>[]>([]);

  // 6. Subscribe to all query keys — resubscribes when keys change
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const keys = stableKeysRef.current;
      const unsubs = keys.map((queryKey, index) => {
        return queryClient.subscribe(
          queryKey,
          onStoreChange,
          configsRef.current[index]?.gcTime,
        );
      });
      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    },
    [queryClient, stableKeys],
  );

  // 7. Get snapshot — return same array reference when values haven't changed
  const getSnapshot = useCallback(() => {
    const next = stableKeysRef.current.map(
      (key) => queryClient.getQueryState(key)!,
    );
    const prev = snapshotRef.current;
    if (prev.length === next.length && prev.every((s, i) => s === next[i])) {
      return prev; // same references -> no re-render
    }
    snapshotRef.current = next;
    return next;
  }, [queryClient, stableKeys]);

  const states = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // 8. Shared fetch-one logic used by fetchAll, window focus, reconnect, and refetch
  const fetchOne = useCallback(
    async (index: number, opts?: { skipStaleCheck?: boolean }) => {
      const key = stableKeysRef.current[index];
      const q = configsRef.current[index];
      if (!key || q.enabled === false) return;

      // Race protection — skip if already fetching this key
      if (fetchingRef.current.has(key)) return;
      fetchingRef.current.add(key);
      const generation = (generationRef.current.get(key) ?? 0) + 1;
      generationRef.current.set(key, generation);

      // Stale check (unless explicitly skipped)
      if (!opts?.skipStaleCheck) {
        const state = queryClient.getQueryState(key);
        const staleTime = parseWindow(q.staleTime);
        const refetchOnMount = q.refetchOnMount ?? true;

        if (state?.isSuccess && state?.updatedAt) {
          if (refetchOnMount === false) {
            fetchingRef.current.delete(key);
            return;
          } else if (refetchOnMount !== "always") {
            if (Date.now() - state.updatedAt < staleTime) {
              fetchingRef.current.delete(key);
              return;
            }
          }
        }
      }

      queryClient.setQueryState(key, {
        isFetching: true,
        ...((q.keepPreviousData ?? true) === false && { data: undefined }),
      });

      const fetcher = async () => await q.proc();
      let resultTuple: [any, null] | [null, ErrorResponse];

      if (!key.startsWith("__local__")) {
        resultTuple = await globalRequestManager.fetch(key, fetcher);
      } else {
        resultTuple = await fetcher();
      }

      // Abort if a newer call superseded this one
      if (generationRef.current.get(key) !== generation) {
        fetchingRef.current.delete(key);
        return;
      }

      const [result, err] = resultTuple;

      if (err) {
        const initData = configsRef.current[index].initialData;
        const resolvedInitData =
          //@ts-ignore
          typeof initData === "function" ? initData() : initData;
        queryClient.setQueryState(key, {
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
        configsRef.current[index].onSuccess?.(finalData);
        configsRef.current[index].onSettled?.(finalData, null);
      }

      fetchingRef.current.delete(key);
    },
    [queryClient],
  );

  // 9. Fetch all queries in parallel
  const fetchAll = useCallback(async () => {
    const promises = stableKeysRef.current.map((_, index) => fetchOne(index));
    await Promise.all(promises);
  }, [fetchOne]);

  // Initial fetch effect
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refetch on window focus
  useEffect(() => {
    let active = true;

    const handleFocus = () => {
      if (!active) return;
      stableKeysRef.current.forEach((_, index) => {
        const q = configsRef.current[index];
        if (!q?.refetchOnWindowFocus) return;
        if (q.enabled === false) return;

        const key = stableKeysRef.current[index];
        const state = queryClient.getQueryState(key);
        if (!state) return;

        // Skip if data is still fresh
        const staleTime = parseWindow(q.staleTime);
        if (
          state.isSuccess &&
          state.updatedAt &&
          Date.now() - state.updatedAt < staleTime
        )
          return;

        fetchOne(index, { skipStaleCheck: true });
      });
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      active = false;
      window.removeEventListener("focus", handleFocus);
    };
  }, [queryClient, stableKeys, fetchOne]);

  // Refetch on network reconnect
  useEffect(() => {
    let active = true;

    const handleOnline = () => {
      if (!active) return;
      stableKeysRef.current.forEach((_, index) => {
        const q = configsRef.current[index];
        if (
          q?.refetchOnWindowFocus === false &&
          q?.refetchOnReconnect !== "always"
        )
          return;
        if (q.enabled === false) return;

        const key = stableKeysRef.current[index];
        const state = queryClient.getQueryState(key);
        if (!state) return;

        const staleTime = parseWindow(q.staleTime);
        if (
          q.refetchOnReconnect !== "always" &&
          state.updatedAt &&
          Date.now() - state.updatedAt < staleTime
        )
          return;

        fetchOne(index, { skipStaleCheck: true });
      });
    };

    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
    };
  }, [queryClient, stableKeys, fetchOne]);

  // 10. Map states to QueryResults format
  return useMemo(() => {
    return states.map((state, index) => {
      const refetch = async () => {
        // Invalidate generation to abort any in-flight fetch
        const key = stableKeysRef.current[index];
        if (key) {
          generationRef.current.set(
            key,
            (generationRef.current.get(key) ?? 0) + 1,
          );
        }
        await fetchOne(index, { skipStaleCheck: true });
        return configsRef.current[index]?.proc;
      };

      const reset = () => {
        const key = stableKeysRef.current[index];
        // Invalidate any in-flight fetch
        if (key) {
          generationRef.current.set(
            key,
            (generationRef.current.get(key) ?? 0) + 1,
          );
          fetchingRef.current.delete(key);
        }
        const q = configsRef.current[index];
        const resolvedInitData =
          typeof q?.initialData === "function"
            ? //@ts-ignore
              q.initialData()
            : q?.initialData;
        queryClient.setQueryState(key, {
          data: resolvedInitData,
          error: undefined,
          isFetching: false,
          isError: false,
          isSuccess: resolvedInitData !== undefined,
          updatedAt: resolvedInitData !== undefined ? Date.now() : undefined,
          isFetched: false,
        });
      };

      // Optimistically update this query's cached data — accepts the new value
      // directly or an updater function `(prev) => next` (React setState style).
      const update = (valueOrUpdater: any) => {
        const key = stableKeysRef.current[index];
        const currentState = queryClient.getQueryState(key);
        const prev = currentState?.data;
        const next =
          typeof valueOrUpdater === "function"
            ? valueOrUpdater(prev)
            : valueOrUpdater;
        queryClient.setQueryState(key, {
          data: next,
          isSuccess: next !== undefined,
          updatedAt: Date.now(),
          isFetched: true,
        });
        return next;
      };

      const isRefetching = state.isFetching && state.data !== undefined;
      const data = state.data;
      const q = configsRef.current[index];
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
        update,
        data: selectedData,
      };
    }) as any;
  }, [states, stableKeys, queryClient, fetchOne]);
}
