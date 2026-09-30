"use client";

import type {
  ErrorResponse,
  ExtractProcOutput,
  ExtractProcInput,
  ExtractProcArgs,
  HasRequiredKeys,
  QueryData,
  QueryResult,
  Unwrap,
  UseQueryOpts,
} from "../types/main.js";
import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  useId,
  useMemo,
} from "react";
import { globalRequestManager } from "../lib/request-manager.js";
import { useQueryClient } from "../provider.js";
import { parseWindow } from "../lib/utils.js";
import { Timeout } from "../types/misc.js";
import { QueryState } from "../types/query-client.js";

/**
 * React hook for executing and caching an Actyx RPC query procedure or server action
 * (with input schema and synchronous `initialData`).
 *
 * Automatically manages asynchronous state, in-flight request deduplication, cache synchronization,
 * background polling, window-focus refetching, and error handling. Because `initialData` is provided,
 * `data` is guaranteed to be defined on initial render.
 *
 * @template TProc - The procedure function or server action returning a promise.
 * @template TInput - Inferred input payload type accepted by the procedure.
 * @template TArgs - Inferred extra positional arguments accepted by the procedure.
 * @template TOutput - Inferred resolved data type returned by the procedure.
 * @template TQueryKey - Tuple type of the query cache key.
 * @template TUnwrap - Boolean flag indicating whether to automatically unwrap the `{ data }` payload.
 * @template TSelectData - Transformed data type if a `select` transformer is supplied.
 * @template TInitialData - Type of synchronous initial data provided.
 *
 * @param proc - The RPC query procedure to execute.
 * @param opts - Query configuration options including `input`, `initialData`, `queryKey`, `enabled`, and lifecycle callbacks.
 * @param extraArgs - Additional positional arguments forwarded to the procedure call.
 * @returns A `QueryResult` object containing non-nullable `data`, `error`, `isLoading`, `refetch`, and status flags.
 *
 * @example
 * ```tsx
 * const { data } = useQuery(getUser, {
 *   input: { id: "123" },
 *   initialData: fallbackUser,
 * });
 * ```
 */
export function useQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TInput = ExtractProcInput<TProc>,
  TArgs extends unknown[] = ExtractProcArgs<TProc>,
  TOutput = ExtractProcOutput<TProc>,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
  TInitialData extends QueryData<Unwrap<TOutput, TUnwrap>> = QueryData<
    Unwrap<TOutput, TUnwrap>
  >,
>(
  proc: TProc,
  opts: [TInput] extends [void | undefined | never]
    ? never
    : (HasRequiredKeys<TInput> extends true
        ? UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData, NoInfer<TInput>> & {
            input: NoInfer<TInput>;
          }
        : UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData, NoInfer<TInput>> & {
            input?: NoInfer<TInput>;
          }) & {
        initialData: TInitialData;
      },
  ...extraArgs: NoInfer<TArgs>
): QueryResult<TOutput, TInitialData, TUnwrap, TSelectData>;

/**
 * React hook for executing and caching an Actyx RPC query procedure or server action
 * (with input schema, without `initialData`).
 *
 * Automatically manages asynchronous state, in-flight request deduplication, cache synchronization,
 * background polling, window-focus refetching, and error handling.
 *
 * @template TProc - The procedure function or server action returning a promise.
 * @template TInput - Inferred input payload type accepted by the procedure.
 * @template TArgs - Inferred extra positional arguments accepted by the procedure.
 * @template TOutput - Inferred resolved data type returned by the procedure.
 * @template TQueryKey - Tuple type of the query cache key.
 * @template TUnwrap - Boolean flag indicating whether to automatically unwrap the `{ data }` payload.
 * @template TInitialData - Defaults to `undefined`.
 * @template TSelectData - Transformed data type if a `select` transformer is supplied.
 *
 * @param proc - The RPC query procedure to execute.
 * @param opts - Query configuration options including `input`, `queryKey`, `enabled`, `staleTime`, and lifecycle callbacks.
 * @param extraArgs - Additional positional arguments forwarded to the procedure call.
 * @returns A `QueryResult` object containing `data` (undefined until resolved), `error`, `isLoading`, `refetch`, etc.
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useQuery(getUser, {
 *   input: { id: "123" },
 *   staleTime: "5m",
 * });
 * ```
 */
export function useQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TInput = ExtractProcInput<TProc>,
  TArgs extends unknown[] = ExtractProcArgs<TProc>,
  TOutput = ExtractProcOutput<TProc>,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TInitialData extends undefined = undefined,
  TSelectData = Unwrap<TOutput, TUnwrap>,
>(
  proc: TProc,
  opts: [TInput] extends [void | undefined | never]
    ? never
    : (HasRequiredKeys<TInput> extends true
        ? UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData, NoInfer<TInput>> & {
            input: NoInfer<TInput>;
          }
        : UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData, NoInfer<TInput>> & {
            input?: NoInfer<TInput>;
          }) & {
        initialData?: undefined;
      },
  ...extraArgs: NoInfer<TArgs>
): QueryResult<TOutput, TInitialData, TUnwrap, TSelectData>;

/**
 * React hook for executing and caching an Actyx RPC query procedure or server action
 * (procedure without input schema, with synchronous `initialData`).
 *
 * Automatically manages asynchronous state, in-flight request deduplication, cache synchronization,
 * background polling, window-focus refetching, and error handling. Because `initialData` is provided,
 * `data` is guaranteed to be defined on initial render.
 *
 * @template TProc - The procedure function or server action returning a promise.
 * @template TInput - Inferred input payload type (`undefined` for procedures without input schema).
 * @template TArgs - Inferred positional arguments accepted by the procedure.
 * @template TOutput - Inferred resolved data type returned by the procedure.
 * @template TQueryKey - Tuple type of the query cache key.
 * @template TUnwrap - Boolean flag indicating whether to automatically unwrap the `{ data }` payload.
 * @template TSelectData - Transformed data type if a `select` transformer is supplied.
 * @template TInitialData - Type of synchronous initial data provided.
 *
 * @param proc - The RPC query procedure to execute.
 * @param opts - Query configuration options including `initialData`, `queryKey`, `enabled`, and lifecycle callbacks.
 * @param extraArgs - Positional arguments forwarded to the procedure call.
 * @returns A `QueryResult` object containing non-nullable `data`, `error`, `isLoading`, `refetch`, and status flags.
 *
 * @example
 * ```tsx
 * const { data } = useQuery(getAllUsers, {
 *   initialData: [],
 * });
 * ```
 */
export function useQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TInput = ExtractProcInput<TProc>,
  TArgs extends unknown[] = ExtractProcArgs<TProc>,
  TOutput = ExtractProcOutput<TProc>,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
  TInitialData extends QueryData<Unwrap<TOutput, TUnwrap>> = QueryData<
    Unwrap<TOutput, TUnwrap>
  >,
>(
  proc: TProc,
  opts: [TInput] extends [void | undefined | never]
    ? UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData, undefined> & {
        initialData: TInitialData;
        input?: undefined;
      }
    : never,
  ...extraArgs: NoInfer<TArgs>
): QueryResult<TOutput, TInitialData, TUnwrap, TSelectData>;

/**
 * React hook for executing and caching an Actyx RPC query procedure or server action
 * (procedure without input schema, without `initialData`).
 *
 * Automatically manages asynchronous state, in-flight request deduplication, cache synchronization,
 * background polling, window-focus refetching, and error handling.
 *
 * @template TProc - The procedure function or server action returning a promise.
 * @template TInput - Inferred input payload type (`undefined` for procedures without input schema).
 * @template TArgs - Inferred positional arguments accepted by the procedure.
 * @template TOutput - Inferred resolved data type returned by the procedure.
 * @template TQueryKey - Tuple type of the query cache key.
 * @template TUnwrap - Boolean flag indicating whether to automatically unwrap the `{ data }` payload.
 * @template TInitialData - Defaults to `undefined`.
 * @template TSelectData - Transformed data type if a `select` transformer is supplied.
 *
 * @param proc - The RPC query procedure to execute.
 * @param opts - Query configuration options including `queryKey`, `enabled`, `staleTime`, and lifecycle callbacks.
 * @param extraArgs - Positional arguments forwarded to the procedure call.
 * @returns A `QueryResult` object containing `data` (undefined until resolved), `error`, `isLoading`, `refetch`, etc.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useQuery(getAllUsers, {
 *   staleTime: "5m",
 * });
 * ```
 */
export function useQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TInput = ExtractProcInput<TProc>,
  TArgs extends unknown[] = ExtractProcArgs<TProc>,
  TOutput = ExtractProcOutput<TProc>,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TInitialData extends undefined = undefined,
  TSelectData = Unwrap<TOutput, TUnwrap>,
>(
  proc: TProc,
  opts?: [TInput] extends [void | undefined | never]
    ? UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData, undefined> & {
        initialData?: undefined;
        input?: undefined;
      }
    : never,
  ...extraArgs: NoInfer<TArgs>
): QueryResult<TOutput, TInitialData, TUnwrap, TSelectData>;

export function useQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TInput = ExtractProcInput<TProc>,
  TArgs extends unknown[] = ExtractProcArgs<TProc>,
  TOutput = ExtractProcOutput<TProc>,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TInitialData = undefined,
  TSelectData = Unwrap<TOutput, TUnwrap>,
>(
  proc: TProc,
  opts?: any,
  ...extraArgs: any[]
): QueryResult<TOutput, TInitialData, TUnwrap, TSelectData> {
  const queryClient = useQueryClient();

  const localId = useId();

  const resolvedOpts = opts || {
    enabled: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
    refetchOnMount: true,
    keepPreviousData: true,
  };

  const serializedInput =
    resolvedOpts?.input !== undefined
      ? typeof resolvedOpts.input === "object" && resolvedOpts.input !== null
        ? JSON.stringify(resolvedOpts.input)
        : String(resolvedOpts.input)
      : "";

  const serializedExtraArgs =
    extraArgs.length > 0
      ? extraArgs
          .map((i: any) =>
            typeof i === "object" && i !== null ? JSON.stringify(i) : String(i),
          )
          .join("|")
      : "";

  const queryKey = resolvedOpts.queryKey
    ? resolvedOpts.queryKey
        .map((i: any) =>
          typeof i === "object" && i !== null ? JSON.stringify(i) : String(i),
        )
        .join("|")
    : serializedInput || serializedExtraArgs
      ? `__local__${localId}|${[serializedInput, serializedExtraArgs].filter(Boolean).join("|")}`
      : `__local__${localId}`;

  const queryDefaults = queryClient.getQueryDefaults(queryKey);

  const enabled = resolvedOpts?.enabled ?? queryDefaults?.enabled ?? true;
  const staleTime = resolvedOpts?.staleTime ?? queryDefaults?.staleTime ?? 0;
  const gcTime = resolvedOpts?.gcTime ?? queryDefaults?.gcTime;
  const refetchOnMount =
    resolvedOpts?.refetchOnMount ?? queryDefaults?.refetchOnMount ?? true;
  const refetchOnWindowFocus =
    resolvedOpts?.refetchOnWindowFocus ??
    queryDefaults?.refetchOnWindowFocus ??
    false;
  const refetchOnReconnect =
    resolvedOpts?.refetchOnReconnect ??
    queryDefaults?.refetchOnReconnect ??
    true;
  const refetchInterval =
    resolvedOpts?.refetchInterval ?? queryDefaults?.refetchInterval ?? 0;
  const keepPreviousData =
    resolvedOpts?.keepPreviousData ?? queryDefaults?.keepPreviousData ?? true;

  // Store callbacks in a ref to avoid re-creating fetchData when they change
  const callbacksRef = useRef({
    onSuccess: (data: any) => {
      resolvedOpts?.onSuccess?.(data);
      queryDefaults?.onSuccess?.(data);
    },
    onError: (err: ErrorResponse) => {
      resolvedOpts?.onError?.(err);
      queryDefaults?.onError?.(err);
    },
    onSettled: (data: any, err: ErrorResponse | null) => {
      resolvedOpts?.onSettled?.(data, err);
      queryDefaults?.onSettled?.(data, err);
    },
    initialData: resolvedOpts?.initialData,
    select: resolvedOpts?.select,
    proc,
    input: resolvedOpts?.input,
    extraArgs,
    keepPreviousData,
    unwrap: resolvedOpts.unwrap,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSuccess: (data: any) => {
        resolvedOpts?.onSuccess?.(data);
        queryDefaults?.onSuccess?.(data);
      },
      onError: (err: ErrorResponse) => {
        resolvedOpts?.onError?.(err);
        queryDefaults?.onError?.(err);
      },
      onSettled: (data: any, err: ErrorResponse | null) => {
        resolvedOpts?.onSettled?.(data, err);
        queryDefaults?.onSettled?.(data, err);
      },
      initialData: resolvedOpts?.initialData,
      select: resolvedOpts?.select,
      proc,
      input: resolvedOpts?.input,
      extraArgs,
      keepPreviousData,
      unwrap: resolvedOpts.unwrap,
    };
  });

  // Guard against stale fetches overwriting reset or newer calls
  const fetchingRef = useRef(false);
  const generationRef = useRef(0);

  // Ensure initial state exists in cache before subscribing
  if (!queryClient.getQueryState(queryKey)) {
    const resolvedInitialData =
      typeof resolvedOpts?.initialData === "function"
        ? resolvedOpts.initialData()
        : resolvedOpts?.initialData;
    queryClient.setQueryState(
      queryKey,
      {
        data: resolvedInitialData as Unwrap<TOutput, TUnwrap> | undefined,
        error: undefined,
        isFetching: false,
        isError: false,
        isSuccess: resolvedInitialData !== undefined,
        updatedAt: resolvedInitialData ? Date.now() : undefined,
        isFetched: resolvedInitialData !== undefined,
      },
      { silent: true },
    );
  }

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      queryClient.subscribe(queryKey, onStoreChange, gcTime),
    [queryClient, queryKey, gcTime],
  );

  // Cache last snapshot to ensure referential stability for useSyncExternalStore.
  // QueryClient.getQueryState returns the cached object reference. QueryClient.setQueryState
  // always creates a new object via spread. So reference equality tells us whether the
  // state actually changed — no need for field-by-field comparison.
  const defaultEmptyState = useRef<QueryState<
    Unwrap<TOutput, TUnwrap>,
    ErrorResponse
  >>({
    data: undefined,
    error: undefined,
    isFetching: false,
    isError: false,
    isSuccess: false,
    updatedAt: 0,
    isFetched: false,
  }).current;

  const snapshotRef = useRef<QueryState<
    Unwrap<TOutput, TUnwrap>,
    ErrorResponse
  > | null>(null);

  const getSnapshot = useCallback(() => {
    const next =
      (queryClient.getQueryState(queryKey) as QueryState<
        Unwrap<TOutput, TUnwrap>,
        ErrorResponse
      >) || defaultEmptyState;
    // Same cached object → return same reference → no re-render
    if (next === snapshotRef.current) return snapshotRef.current;
    snapshotRef.current = next;
    return next;
  }, [queryClient, queryKey, defaultEmptyState]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const intervalRef = useRef<Timeout | null>(null);

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return undefined;
    fetchingRef.current = true;
    const generation = ++generationRef.current;

    queryClient.setQueryState(queryKey, {
      isFetching: true,
      ...(callbacksRef.current.keepPreviousData === false && {
        data: undefined,
      }),
    });

    let resultTuple: any;

    const fetcher = async () => {
      const { proc, input, extraArgs: args } = callbacksRef.current;
      if (input !== undefined) {
        return await proc(input, ...(args || []));
      }
      if (args && args.length > 0) {
        return await proc(...args);
      }
      return await proc();
    };

    try {
      if (!queryKey.startsWith("__local__")) {
        resultTuple = await globalRequestManager.fetch(queryKey, fetcher);
      } else {
        resultTuple = await fetcher();
      }
    } catch (e: any) {
      resultTuple = [null, e];
    }

    let result: any;
    let err: ErrorResponse | null = null;
    if (Array.isArray(resultTuple) && resultTuple.length === 2) {
      result = resultTuple[0];
      err = resultTuple[1];
    } else {
      result = resultTuple;
      err = null;
    }

    // Abort if a newer call superseded this one (e.g. reset + re-fetch)
    if (generation !== generationRef.current) return result;

    if (err) {
      const initData = callbacksRef.current.initialData;
      const resolvedInitData =
        typeof initData === "function" ? initData() : initData;
      queryClient.setQueryState(queryKey, {
        error: err,
        isError: true,
        isSuccess: false,
        isFetching: false,
        data: resolvedInitData,
        updatedAt: Date.now(),
        isFetched: true,
      });
      callbacksRef.current.onError?.(err);
      callbacksRef.current.onSettled?.(null, err);
    } else {
      const unwrapped =
        callbacksRef.current.unwrap === true &&
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

      const finalData = callbacksRef.current.select
        ? callbacksRef.current.select(unwrapped)
        : (unwrapped as unknown as TSelectData);
      callbacksRef.current.onSuccess?.(finalData);
      callbacksRef.current.onSettled?.(finalData, null);
    }

    fetchingRef.current = false;
    return result;
  }, [queryKey, queryClient]);

  const refetch = useCallback(fetchData, [fetchData]);

  const reset = useCallback(() => {
    ++generationRef.current; // invalidate any in-flight fetch
    fetchingRef.current = false;
    const initData = callbacksRef.current.initialData;
    const resolvedInitData =
      typeof initData === "function" ? initData() : initData;
    queryClient.setQueryState(queryKey, {
      data: resolvedInitData,
      error: undefined,
      isFetching: false,
      isError: false,
      isSuccess: resolvedInitData !== undefined,
      updatedAt: resolvedInitData ? Date.now() : undefined,
      isFetched: false,
    });
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [queryClient, queryKey]);

  // Optimistically update the cached data for this query.
  // Accepts either:
  // 1) 2 arguments: (indexOrPredicate, itemUpdater) for targeted array/collection updates via queryClient.update
  // 2) 1 argument: (valueOrUpdater) for direct whole-state replacement
  const update = useCallback(
    (...args: any[]) => {
      if (args.length >= 2) {
        const [arg, itemUpdater] = args;
        return queryClient.update(queryKey, arg, itemUpdater);
      }

      const [valueOrUpdater] = args;
      const currentState = queryClient.getQueryState(queryKey);
      const prev = currentState?.data;
      const next =
        typeof valueOrUpdater === "function"
          ? (
              valueOrUpdater as (
                prev: Unwrap<TOutput, TUnwrap> | undefined,
              ) => Unwrap<TOutput, TUnwrap> | undefined
            )(prev)
          : valueOrUpdater;
      queryClient.setQueryState(queryKey, {
        data: next,
        isSuccess: next !== undefined,
        updatedAt: Date.now(),
        isFetched: true,
      });
      return next;
    },
    [queryClient, queryKey],
  );

  // Initial fetch
  useEffect(() => {
    if (enabled === false) return;

    const state = queryClient.getQueryState(queryKey);
    const parsedStaleTime = parseWindow(staleTime);

    let shouldFetch = true;

    if (state?.isSuccess && state?.updatedAt) {
      if (refetchOnMount === false) {
        shouldFetch = false;
      } else if (refetchOnMount !== "always") {
        // Check if data is stale
        const isStale = Date.now() - state.updatedAt >= parsedStaleTime;
        if (!isStale) {
          shouldFetch = false;
        }
      }
    }

    if (shouldFetch) {
      fetchData();
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, staleTime, refetchOnMount, fetchData, queryKey, queryClient]);

  // Refetch interval
  useEffect(() => {
    if (refetchInterval && enabled !== false) {
      intervalRef.current = setInterval(() => refetch(), refetchInterval);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [refetchInterval, enabled, refetch]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      if (enabled === false) return;
      refetch();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchOnWindowFocus, enabled, refetch]);

  // Refetch on network reconnect
  useEffect(() => {
    if (!refetchOnReconnect) return;

    const handleOnline = () => {
      if (enabled === false) return;
      const currentState = queryClient.getQueryState(queryKey);
      const parsedStaleTime = parseWindow(staleTime);
      if (
        refetchOnReconnect === "always" ||
        !currentState?.updatedAt ||
        Date.now() - currentState.updatedAt >= parsedStaleTime
      ) {
        refetch();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [refetchOnReconnect, enabled, staleTime, refetch, queryKey, queryClient]);

  // Listen for query invalidation
  useEffect(() => {
    if (enabled === false) return;

    return queryClient.onInvalidate(queryKey, () => {
      refetch();
    });
  }, [queryClient, queryKey, refetch, enabled]);

  const isRefetching = state.isFetching && state.data !== undefined;

  const data = state.data;
  const selectedData = useMemo(() => {
    if (data === undefined) return undefined;
    const resolved =
      callbacksRef.current.unwrap === true &&
      data &&
      typeof data === "object" &&
      "data" in data
        ? (data as any).data
        : data;
    if (callbacksRef.current.select) return callbacksRef.current.select(resolved);
    return resolved;
  }, [data]);

  const isEmpty =
    state.isFetched &&
    (selectedData === null ||
      selectedData === undefined ||
      (Array.isArray(selectedData) && selectedData.length === 0));
  const isLoading = !state.isFetched || (state.isFetching && isEmpty);
  const prepend = useCallback(
    (item: any) => queryClient.prepend(queryKey, item),
    [queryClient, queryKey],
  );

  const append = useCallback(
    (item: any) => queryClient.append(queryKey, item),
    [queryClient, queryKey],
  );

  const insert = useCallback(
    (index: number, item: any) => queryClient.insert(queryKey, index, item),
    [queryClient, queryKey],
  );

  const remove = useCallback(
    (arg: number | ((item: any) => boolean)) =>
      queryClient.remove(queryKey, arg),
    [queryClient, queryKey],
  );

  return {
    error: state.error,
    isFetching: state.isFetching,
    isRefetching,
    isError: state.isError,
    isSuccess: state.isSuccess,
    isFetched: state.isFetched,
    isEmpty,
    isLoading,
    refetch,
    reset,
    update,
    prepend,
    append,
    insert,
    remove,
    data: selectedData,
  } as unknown as QueryResult<TOutput, TInitialData, TUnwrap, TSelectData>;
}
