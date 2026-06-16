import type { ErrorResponse } from "../../types/misc.js";
import {
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
  useId,
  useMemo,
} from "react";
import { globalRequestManager } from "../lib/request-manager.js";
import { QueryResult, Unwrap, UseQueryOpts } from "../types.js";
import { useQueryClient } from "../provider.js";
import { QueryState } from "../lib/query-client.js";
import { parseWindow } from "../../lib/utils.js";

export function useQuery<
  TOutput,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TInitialData extends
    | Omit<Unwrap<TOutput, TUnwrap>, "success">
    | (() => Omit<Unwrap<TOutput, TUnwrap>, "success">) = Omit<
    Unwrap<TOutput, TUnwrap>,
    "success"
  >,
  TSelectData = Unwrap<TOutput, TUnwrap>,
>(
  proc: () => Promise<[TOutput, null] | [null, ErrorResponse]>,
  opts: UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData> & {
    initialData: TInitialData;
  },
): QueryResult<TOutput, TInitialData, TUnwrap, TSelectData>;

export function useQuery<
  TOutput,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TInitialData extends undefined = undefined,
  TSelectData = Unwrap<TOutput, TUnwrap>,
>(
  proc: () => Promise<[TOutput, null] | [null, ErrorResponse]>,
  opts?: UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData> & {
    initialData?: undefined;
  },
): QueryResult<TOutput, undefined, TUnwrap, TSelectData>;

export function useQuery<
  TOutput,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TInitialData = undefined,
  TSelectData = Unwrap<TOutput, TUnwrap>,
>(
  proc: () => Promise<[TOutput, null] | [null, ErrorResponse]>,
  opts: UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData> & {
    initialData?: TInitialData;
  } = {
    enabled: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
    refetchOnMount: true,
  },
): QueryResult<TOutput, TInitialData, TUnwrap, TSelectData> {
  const queryClient = useQueryClient();

  const localId = useId();

  const queryKey = opts.queryKey
    ? opts.queryKey
        .map((i) =>
          typeof i === "object" && i !== null ? JSON.stringify(i) : String(i),
        )
        .join("|")
    : `__local__${localId}`;

  // Store callbacks in a ref to avoid re-creating fetchData when they change
  const callbacksRef = useRef({
    onSuccess: opts?.onSuccess,
    onError: opts?.onError,
    onSettled: opts?.onSettled,
    initialData: opts?.initialData,
    select: opts?.select,
    proc,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSuccess: opts?.onSuccess,
      onError: opts?.onError,
      onSettled: opts?.onSettled,
      initialData: opts?.initialData,
      select: opts?.select,
      proc,
    };
  });

  // Ensure initial state exists in cache before subscribing
  if (!queryClient.getQueryState(queryKey)) {
    const resolvedInitialData =
      typeof opts?.initialData === "function"
        ? opts.initialData()
        : opts?.initialData;
    queryClient.setQueryState(
      queryKey,
      {
        data: resolvedInitialData as Unwrap<TOutput, TUnwrap> | undefined,
        error: undefined,
        isFetching: false,
        isError: false,
        isSuccess: resolvedInitialData !== undefined,
        // updatedAt: resolvedInitialData !== undefined ? Date.now() : undefined,
        isFetched: false,
      },
      { silent: true },
    );
  }

  const subscribe = useCallback(
    (onStoreChange: () => void) =>
      queryClient.subscribe(queryKey, onStoreChange, opts?.gcTime),
    [queryClient, queryKey, opts?.gcTime],
  );

  const getSnapshot = useCallback(() => {
    // we guaranteed it exists above
    return queryClient.getQueryState(queryKey) as QueryState<
      Unwrap<TOutput, TUnwrap>,
      ErrorResponse
    >;
  }, [queryClient, queryKey]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    queryClient.setQueryState(queryKey, { isFetching: true });

    let resultTuple: [TOutput, null] | [null, ErrorResponse];

    const fetcher = async () => {
      return await callbacksRef.current.proc();
    };

    if (!queryKey.startsWith("__local__")) {
      resultTuple = await globalRequestManager.fetch(queryKey, fetcher);
    } else {
      resultTuple = await fetcher();
    }

    const [result, err] = resultTuple;

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
        isFetched: true,
      });
      callbacksRef.current.onError?.(err);
    } else {
      const unwrapped =
        opts.unwrap === true &&
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

    if (err) {
      callbacksRef.current.onSettled?.(null, err);
    }

    return result;
  }, [queryKey, queryClient, opts.unwrap]);

  const refetch = useCallback(fetchData, [fetchData]);

  const reset = useCallback(() => {
    const initData = callbacksRef.current.initialData;
    const resolvedInitData =
      typeof initData === "function" ? initData() : initData;
    queryClient.setQueryState(queryKey, {
      data: resolvedInitData,
      error: undefined,
      isFetching: false,
      isError: false,
      isSuccess: resolvedInitData !== undefined,
      // updatedAt: resolvedInitData !== undefined ? Date.now() : undefined,
      isFetched: false,
    });
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [queryClient, queryKey]);

  // Initial fetch
  useEffect(() => {
    if (opts?.enabled === false) {
      return;
    }

    const state = queryClient.getQueryState(queryKey);
    const staleTime = parseWindow(opts.staleTime);
    const refetchOnMount = opts?.refetchOnMount ?? true;

    let shouldFetch = true;

    if (state?.isSuccess && state?.updatedAt) {
      if (refetchOnMount === false) {
        shouldFetch = false;
      } else if (refetchOnMount !== "always") {
        // Check if data is stale
        const isStale = Date.now() - state.updatedAt >= staleTime;
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
  }, [
    opts?.enabled,
    opts?.staleTime,
    opts?.refetchOnMount,
    fetchData,
    queryKey,
    queryClient,
  ]);

  // Refetch interval
  useEffect(() => {
    if (opts?.refetchInterval && opts.enabled !== false) {
      intervalRef.current = setInterval(() => refetch(), opts.refetchInterval);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [opts?.refetchInterval, opts?.enabled, refetch]);

  // Refetch on window focus
  useEffect(() => {
    if (!opts?.refetchOnWindowFocus) return;

    const handleFocus = () => refetch();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [opts?.refetchOnWindowFocus, refetch]);

  // Refetch on network reconnect
  useEffect(() => {
    const refetchOnReconnect = opts?.refetchOnReconnect ?? true;
    if (!refetchOnReconnect) return;

    const handleOnline = () => {
      if (opts?.enabled === false) return;
      const currentState = queryClient.getQueryState(queryKey);
      const staleTime = parseWindow(opts.staleTime);
      if (
        refetchOnReconnect === "always" ||
        !currentState?.updatedAt ||
        Date.now() - currentState.updatedAt >= staleTime
      ) {
        refetch();
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [
    opts?.refetchOnReconnect,
    opts?.enabled,
    opts?.staleTime,
    refetch,
    queryKey,
    queryClient,
  ]);

  // Listen for query invalidation
  useEffect(() => {
    if (opts?.enabled === false) return;

    return queryClient.onInvalidate(queryKey, () => {
      refetch();
    });
  }, [queryClient, queryKey, refetch, opts?.enabled]);

  const isRefetching = state.isFetching && state.data !== undefined;

  const data = state.data;
  const selectedData = useMemo(() => {
    if (data === undefined) return undefined;
    if (opts?.select) return opts.select(data);
    return data;
  }, [data, opts?.select]);

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
  } as QueryResult<TOutput, TInitialData, TUnwrap, TSelectData>;
}
