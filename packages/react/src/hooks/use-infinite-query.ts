import {
  useCallback,
  useEffect,
  useRef,
  useId,
  useSyncExternalStore,
  useMemo,
  useState,
} from "react";
import type {
  ErrorResponse,
  ExtractInfiniteItem,
  ExtractInfinitePage,
  InfiniteQueryPage,
  UseInfiniteQueryOpts,
  InfiniteQueryResult,
} from "../types/main.js";
import { useQueryClient } from "../provider.js";
import { globalRequestManager } from "../lib/request-manager.js";
import { defaultSyncSelection, parseWindow } from "../lib/utils.js";
import { Timeout } from "../types/misc.js";

type InfData<TPage, TFullPage = InfiniteQueryPage<TPage>> = {
  pages: TFullPage[];
  pageParams: (string | number)[];
};

export function useInfiniteQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TFullPage = ExtractInfinitePage<TProc>,
  TPage = ExtractInfiniteItem<TFullPage>,
  TInput = Parameters<TProc>[0],
  TQueryKey extends unknown[] = unknown[],
  TArgs extends unknown[] = Parameters<TProc> extends [any, ...infer Rest]
    ? Rest
    : [],
>(
  proc: TProc,
  opts?: UseInfiniteQueryOpts<TInput, TPage, TQueryKey, TFullPage, TArgs>,
  ...extraArgs: unknown[]
): Omit<
  InfiniteQueryResult<TPage, TFullPage>,
  "fetchPrevious" | "hasPrevious"
> {
  const [selectedItem, setSelectedItem] = useState<TPage | undefined>(
    undefined,
  );
  const queryClient = useQueryClient();
  const localId = useId();

  const queryKey = opts?.queryKey
    ? opts.queryKey.map(String).join("|")
    : `__local_inf__${localId}`;

  const queryDefaults = queryClient.getQueryDefaults(queryKey);

  const {
    input: baseInput,
    enabled = queryDefaults?.enabled ?? true,
    initialPageParam,
    initialData,
    getNextPageParam,
    maxPages,
    refetchOnWindowFocus = queryDefaults?.refetchOnWindowFocus ?? false,
    refetchInterval = queryDefaults?.refetchInterval ?? 0,
    keepPreviousData = queryDefaults?.keepPreviousData ?? true,
    onSuccess,
    onError,
    onSettled,
    arrange,
    syncSelection = false,
  } = opts || {};

  const resolvedArgs = extraArgs as unknown as TArgs;

  const staleTime = opts?.staleTime ?? queryDefaults?.staleTime ?? 0;
  const gcTime = opts?.gcTime ?? queryDefaults?.gcTime;
  const refetchOnMount =
    opts?.refetchOnMount ?? queryDefaults?.refetchOnMount ?? true;
  const refetchOnReconnect =
    opts?.refetchOnReconnect ?? queryDefaults?.refetchOnReconnect ?? true;

  const callbacksRef = useRef({
    onSuccess: (data: any) => {
      onSuccess?.(data);
      queryDefaults?.onSuccess?.(data);
    },
    onError: (err: ErrorResponse) => {
      onError?.(err);
      queryDefaults?.onError?.(err);
    },
    onSettled: (data?: any, err?: ErrorResponse | null) => {
      (onSettled as any)?.();
      queryDefaults?.onSettled?.(data, err ?? null);
    },
    arrange,
    proc,
    baseInput,
    args: resolvedArgs,
    initialData,
    keepPreviousData,
    syncSelection,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSuccess: (data: any) => {
        onSuccess?.(data);
        queryDefaults?.onSuccess?.(data);
      },
      onError: (err: ErrorResponse) => {
        onError?.(err);
        queryDefaults?.onError?.(err);
      },
      onSettled: (data?: any, err?: ErrorResponse | null) => {
        (onSettled as any)?.();
        queryDefaults?.onSettled?.(data, err ?? null);
      },
      arrange,
      proc,
      baseInput,
      args: resolvedArgs,
      initialData,
      keepPreviousData,
      syncSelection,
    };
  });

  // Initialize cache
  const existingState = queryClient.getQueryState(queryKey);
  const existingData = existingState?.data;
  const hasValidInfData =
    existingData !== null &&
    typeof existingData === "object" &&
    Array.isArray((existingData as any).pages);

  if (!existingState || !hasValidInfData) {
    const resolvedInitialData =
      typeof initialData === "function" ? initialData() : initialData;
    queryClient.setQueryState(
      queryKey,
      {
        data: resolvedInitialData || {
          pages: [],
          pageParams: (initialPageParam !== undefined
            ? [initialPageParam]
            : []) as (string | number)[],
        },
        error: undefined,
        isFetching: false,
        isError: false,
        isSuccess: !!resolvedInitialData,
        updatedAt: resolvedInitialData ? Date.now() : undefined,
        isFetched: !!resolvedInitialData,
      },
      { silent: true },
    );
  }

  const subscribe = useCallback(
    (onChange: () => void) => queryClient.subscribe(queryKey, onChange, gcTime),
    [queryClient, queryKey, gcTime],
  );

  const getSnapshot = useCallback(
    () => queryClient.getQueryState(queryKey)!,
    [queryClient, queryKey],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const rawData = state?.data;
  const isInfData =
    rawData !== null &&
    typeof rawData === "object" &&
    Array.isArray((rawData as any).pages);
  const data: InfData<TPage, TFullPage> = isInfData
    ? (rawData as InfData<TPage, TFullPage>)
    : {
        pages: [],
        pageParams: (initialPageParam !== undefined
          ? [initialPageParam]
          : []) as (string | number)[],
      };
  const pages: TFullPage[] = Array.isArray(data.pages) ? data.pages : [];
  const pageParams: (string | number)[] = Array.isArray(data.pageParams)
    ? data.pageParams
    : [];

  const intervalRef = useRef<Timeout | null>(null);
  const fetchedCursorsRef = useRef<Set<string | number>>(new Set());
  const fetchingRef = useRef(false);

  const flattenedData = pages.flatMap((page) =>
    page && Array.isArray((page as any).data) ? (page as any).data : [],
  );
  const lastPage = pages.length > 0 ? pages[pages.length - 1] : undefined;
  const hasNext = lastPage
    ? !!(
        getNextPageParam?.(lastPage, pages) ??
        (lastPage as any)?.nextCursor ??
        (lastPage as any)?.hasMore
      )
    : false;

  const fetchPage = useCallback(
    async (cursor?: string | number): Promise<TFullPage> => {
      const hasBaseInput =
        callbacksRef.current.baseInput !== undefined &&
        callbacksRef.current.baseInput !== null;
      let pageInput =
        cursor !== undefined
          ? hasBaseInput
            ? { ...callbacksRef.current.baseInput, cursor }
            : { cursor }
          : callbacksRef.current.baseInput;

      if (!hasBaseInput) {
        for (const arg of callbacksRef.current.args as TArgs) {
          if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
            pageInput = {
              ...pageInput,
              ...arg,
            } as TInput;
          }
        }
      }

      const fetcher = async () =>
        await callbacksRef.current.proc(
          pageInput as TInput,
          ...(callbacksRef.current.args as TArgs),
        );

      const subKey = cursor !== undefined ? `${queryKey}|${cursor}` : queryKey;
      let resultTuple: [TFullPage, null] | [null, ErrorResponse];

      if (!queryKey.startsWith("__local__")) {
        resultTuple = await globalRequestManager.fetch(subKey, fetcher);
      } else {
        resultTuple = await fetcher();
      }

      const [result, err] = resultTuple;

      if (err) throw err;
      return result as TFullPage;
    },
    [queryKey],
  );

  const fetchNext = useCallback(async () => {
    if (!hasNext || state.isFetching || fetchingRef.current) return undefined;
    fetchingRef.current = true;
    queryClient.setQueryState(queryKey, { isFetching: true });

    const lastPage = pages[pages.length - 1];
    const nextCursor =
      getNextPageParam?.(lastPage, pages) ?? (lastPage as any)?.nextCursor;

    if (!nextCursor || fetchedCursorsRef.current.has(nextCursor)) {
      queryClient.setQueryState(queryKey, { isFetching: false });
      fetchingRef.current = false;
      return undefined;
    }

    try {
      const newPage = await fetchPage(nextCursor);
      fetchedCursorsRef.current.add(nextCursor);

      let newPages = [...pages, newPage];
      let newParams = [...pageParams, nextCursor];
      if (maxPages && newPages.length > maxPages) {
        newPages = newPages.slice(-maxPages);
        newParams = newParams.slice(-maxPages);
      }

      const newData = { pages: newPages, pageParams: newParams };
      queryClient.setQueryState(queryKey, {
        data: newData,
        isFetching: false,
        isError: false,
        isSuccess: true,
        error: undefined,
        updatedAt: Date.now(),
        isFetched: true,
      });
      callbacksRef.current.onSuccess?.(newData);
      callbacksRef.current.onSettled?.();
      return newPage;
    } catch (err) {
      const errorRes = err as ErrorResponse;
      queryClient.setQueryState(queryKey, {
        isFetching: false,
        error: errorRes,
        isError: true,
        isFetched: true,
      });
      callbacksRef.current.onError?.(errorRes);
      callbacksRef.current.onSettled?.();
      return undefined;
    } finally {
      fetchingRef.current = false;
    }
  }, [
    hasNext,
    pages,
    pageParams,
    fetchPage,
    getNextPageParam,
    maxPages,
    queryClient,
    queryKey,
  ]);

  const refetch = useCallback(async () => {
    if (queryClient.isFetching(queryKey) || fetchingRef.current) return;

    fetchingRef.current = true;
    queryClient.setQueryState(queryKey, {
      isFetching: true,
      error: undefined,
      ...(callbacksRef.current.keepPreviousData === false && {
        data: { pages: [], pageParams: [] },
      }),
    });
    fetchedCursorsRef.current.clear();

    try {
      const firstPage = await fetchPage(initialPageParam);
      if (initialPageParam !== undefined)
        fetchedCursorsRef.current.add(initialPageParam);

      const newData = {
        pages: [firstPage],
        pageParams: [initialPageParam].filter(Boolean) as (string | number)[],
      };

      queryClient.setQueryState(queryKey, {
        data: newData,
        isFetching: false,
        isError: false,
        isSuccess: true,
        updatedAt: Date.now(),
        isFetched: true,
      });
      callbacksRef.current.onSuccess?.(newData);
    } catch (err) {
      const errorRes = err as ErrorResponse;
      queryClient.setQueryState(queryKey, {
        error: errorRes,
        isError: true,
        isFetching: false,
        isFetched: true,
      });
      callbacksRef.current.onError?.(errorRes);
    } finally {
      fetchingRef.current = false;
      callbacksRef.current.onSettled?.();
    }
  }, [fetchPage, initialPageParam, queryClient, queryKey]);

  const reset = useCallback(() => {
    const initData = callbacksRef.current.initialData;
    const resolvedInitData =
      typeof initData === "function" ? initData() : initData;
    queryClient.setQueryState(queryKey, {
      data: resolvedInitData || {
        pages: [],
        pageParams: [initialPageParam].filter(Boolean),
      },
      isFetching: false,
      error: undefined,
      isError: false,
      isSuccess: !!resolvedInitData,
      updatedAt: resolvedInitData ? Date.now() : undefined,
      isFetched: false,
    });
    fetchedCursorsRef.current.clear();
    setSelectedItem(undefined);
  }, [initialPageParam, queryClient, queryKey]);

  const snapshot = useCallback(
    () => queryClient.snapshot(queryKey),
    [queryClient, queryKey],
  );

  const remove = useCallback(
    (arg: number | ((item: TPage) => boolean)) => {
      return queryClient.remove(queryKey, arg);
    },
    [queryClient, queryKey],
  );

  const update = useCallback(
    (
      arg: number | ((item: TPage) => boolean),
      updater: TPage | ((item: TPage) => TPage),
    ) => {
      return queryClient.update(queryKey, arg, updater);
    },
    [queryClient, queryKey],
  );

  const prepend = useCallback(
    (item: TPage | TPage[]) => {
      return queryClient.prepend(queryKey, item);
    },
    [queryClient, queryKey],
  );

  const append = useCallback(
    (item: TPage | TPage[]) => {
      return queryClient.append(queryKey, item);
    },
    [queryClient, queryKey],
  );

  const insert = useCallback(
    (index: number, item: TPage | TPage[]) => {
      return queryClient.insert(queryKey, index, item);
    },
    [queryClient, queryKey],
  );

  const setPages = useCallback(
    (updater: (oldPages: TFullPage[]) => TFullPage[]) => {
      const currentState = queryClient.getQueryState(queryKey);
      const previousData = currentState?.data;
      const rollback = () => {
        queryClient.setQueryState(queryKey, { data: previousData });
      };

      if (!currentState || !currentState.data) return rollback;

      const oldPages = (currentState.data as any).pages as TFullPage[];
      const newPages = updater(oldPages);

      queryClient.setQueryState(queryKey, {
        data: {
          ...(currentState.data as any),
          pages: newPages,
        },
      });

      return rollback;
    },
    [queryClient, queryKey],
  );

  const initialFetchRef = useRef(false);

  useEffect(() => {
    if (enabled === false) return;

    // Invalidate listener
    const unsubscribe = queryClient.onInvalidate(queryKey, () => {
      refetch();
    });

    if (!initialFetchRef.current) {
      initialFetchRef.current = true;

      const currentState = queryClient.getQueryState(queryKey);
      const parsedStaleTime = parseWindow(staleTime);
      let shouldFetch = true;

      if (currentState?.isSuccess && currentState?.updatedAt) {
        if (refetchOnMount === false) {
          shouldFetch = false;
        } else if (refetchOnMount !== "always") {
          const isStale =
            Date.now() - currentState.updatedAt >= parsedStaleTime;
          if (!isStale) {
            shouldFetch = false;
          }
        }
      }

      const currentData = currentState?.data as
        | InfData<TPage, TFullPage>
        | undefined;
      if ((currentData?.pages?.length || 0) === 0) {
        shouldFetch = true;
      }

      if (shouldFetch) {
        refetch();
      }
    }

    return unsubscribe;
  }, [enabled, queryClient, queryKey, refetch, staleTime, refetchOnMount]);

  // Sync pageParams into fetchedCursorsRef to prevent double-fetching cached pages
  useEffect(() => {
    for (const param of pageParams) {
      if (param !== undefined && param !== null) {
        fetchedCursorsRef.current.add(param);
      }
    }
  }, [pageParams]);

  // Reset state when queryKey changes
  useEffect(() => {
    initialFetchRef.current = false;
    fetchedCursorsRef.current.clear();
  }, [queryKey]);

  // Refetch interval
  useEffect(() => {
    if (refetchInterval && enabled !== false && pages.length > 0) {
      intervalRef.current = setInterval(() => refetch(), refetchInterval);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [refetchInterval, enabled, pages.length, refetch]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus) return;
    const handleFocus = () => {
      if (enabled !== false) refetch();
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
  }, [refetchOnReconnect, enabled, refetch, queryClient, queryKey, staleTime]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Whether ANY fetch is in flight (initial, refetch, or pagination)
  const isFetching = state.isFetching;
  // Whether subsequent pages or background refreshes are in flight
  const isRefetching = state.isFetching && pages.length > 0;
  // Whether initial data is still loading
  const isLoading =
    !state.isFetched || (state.isFetching && flattenedData.length === 0);
  // Whether data has finished fetching and has 0 items
  const isEmpty = state.isFetched && flattenedData.length === 0;

  const arrangedData = useMemo(() => {
    if (arrange) {
      return arrange(flattenedData);
    }
    return flattenedData;
  }, [flattenedData, arrange]);

  // Sync selectedItem with latest data instance
  useEffect(() => {
    const cleanup = callbacksRef.current.syncSelection;
    if (!cleanup) return;

    setSelectedItem((prev) => {
      if (prev === undefined) return prev;
      const matches =
        typeof cleanup === "function" ? cleanup : defaultSyncSelection;
      return arrangedData.find((item) => matches(item, prev));
    });
  }, [arrangedData]);

  return {
    data: arrangedData,
    pages,
    pageParams,
    fetchNext,
    hasNext,
    isLoading,
    isFetching,
    isRefetching,
    isError: state.isError,
    isSuccess: state.isSuccess,
    error: state.error,
    isFetched: state.isFetched,
    isEmpty,
    selectedItem,
    selectItem: (item: TPage | undefined | null) =>
      setSelectedItem(item ?? undefined),
    refetch,
    reset,
    remove,
    update,
    prepend,
    append,
    insert,
    setPages,
    snapshot,
  };
}
