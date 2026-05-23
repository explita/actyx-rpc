import {
  useCallback,
  useEffect,
  useRef,
  useId,
  useSyncExternalStore,
} from "react";
import type { ErrorResponse, QueryResult } from "../../types/misc.js";
import type {
  InfiniteQueryPage,
  UseInfiniteQueryOpts,
  UseInfiniteQueryReturn,
  WithoutCursor,
} from "../types.js";
import { useQueryClient } from "../provider.js";
import { globalRequestManager } from "../lib/request-manager.js";

type InfData<TPage> = {
  pages: InfiniteQueryPage<TPage>[];
  pageParams: (string | number)[];
};

export function useInfiniteQuery<
  TInput,
  TPage,
  TQueryKey extends unknown[] = unknown[],
>(
  proc: (
    input: WithoutCursor<TInput>,
  ) => Promise<QueryResult<InfiniteQueryPage<TPage>>>,
  opts: UseInfiniteQueryOpts<TInput, TPage, TQueryKey>,
): Omit<
  UseInfiniteQueryReturn<TPage>,
  "fetchPrevious" | "hasPrevious" | "isFetchingPrevious" | "previousCursor"
> {
  const queryClient = useQueryClient();
  const localId = useId();

  const queryKey = opts.queryKey
    ? opts.queryKey.map(String).join("|")
    : `__local_inf__${localId}`;

  const {
    initialInput,
    enabled = true,
    initialPageParam,
    initialData,
    getNextPageParam,
    maxPages,
    refetchOnWindowFocus = false,
    refetchInterval = 0,
    onSuccess,
    onError,
    onSettled,
  } = opts;

  const callbacksRef = useRef({ onSuccess, onSettled, proc, initialInput });
  useEffect(() => {
    callbacksRef.current = { onSuccess, onSettled, proc, initialInput };
  });

  // Initialize cache
  if (!queryClient.getQueryState(queryKey)) {
    queryClient.setQueryState(
      queryKey,
      {
        data: initialData || {
          pages: [],
          pageParams: [initialPageParam].filter(Boolean),
        },
        error: undefined,
        isFetching: false,
        isError: false,
        isSuccess: !!initialData,
      },
      { silent: true },
    );
  }

  const subscribe = useCallback(
    (onChange: () => void) =>
      queryClient.subscribe(queryKey, onChange, opts?.gcTime),
    [queryClient, queryKey, opts?.gcTime],
  );
  const getSnapshot = useCallback(
    () => queryClient.getQueryState(queryKey)!,
    [queryClient, queryKey],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const data = (state.data as InfData<TPage>) || { pages: [], pageParams: [] };
  const pages = data.pages;
  const pageParams = data.pageParams;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchedCursorsRef = useRef<Set<string | number>>(new Set());

  const flattenedData = pages.flatMap((page) => page.data);
  const hasNext =
    pages.length > 0
      ? !!(
          getNextPageParam?.(pages[pages.length - 1]) ??
          pages[pages.length - 1]?.nextCursor
        )
      : false;

  const fetchPage = useCallback(
    async (cursor?: string | number): Promise<InfiniteQueryPage<TPage>> => {
      const fetcher = async () =>
        await callbacksRef.current.proc({
          ...callbacksRef.current.initialInput,
          cursor,
        } as WithoutCursor<TInput>);

      const subKey = cursor !== undefined ? `${queryKey}|${cursor}` : queryKey;
      let resultTuple: [InfiniteQueryPage<TPage>, null] | [null, ErrorResponse];

      if (!queryKey.startsWith("__local__")) {
        resultTuple = await globalRequestManager.fetch(subKey, fetcher);
      } else {
        resultTuple = await fetcher();
      }

      const [result, err] = resultTuple;

      if (err) throw err;
      return result as InfiniteQueryPage<TPage>;
    },
    [queryKey],
  );

  const fetchNext = useCallback(async () => {
    if (!hasNext || state.isFetching) return undefined;
    queryClient.setQueryState(queryKey, { isFetching: true });

    const lastPage = pages[pages.length - 1];
    const nextCursor = getNextPageParam?.(lastPage) ?? lastPage?.nextCursor;

    if (!nextCursor || fetchedCursorsRef.current.has(nextCursor)) {
      queryClient.setQueryState(queryKey, { isFetching: false });
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
      });
      callbacksRef.current.onSuccess?.(newData);
      callbacksRef.current.onSettled?.();
      return newPage;
    } catch (err) {
      queryClient.setQueryState(queryKey, {
        isFetching: false,
        error: err as ErrorResponse,
        isError: true,
      });
      callbacksRef.current.onSettled?.();
      return undefined;
    }
  }, [
    hasNext,
    state.isFetching,
    pages,
    pageParams,
    fetchPage,
    getNextPageParam,
    maxPages,
    queryClient,
    queryKey,
  ]);

  const refetch = useCallback(async () => {
    queryClient.setQueryState(queryKey, {
      isFetching: true,
      error: undefined,
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
      });
      callbacksRef.current.onSuccess?.(newData);
    } catch (err) {
      queryClient.setQueryState(queryKey, {
        error: err as ErrorResponse,
        isError: true,
        isFetching: false,
      });
    } finally {
      callbacksRef.current.onSettled?.();
    }
  }, [fetchPage, initialPageParam, queryClient, queryKey]);

  const reset = useCallback(() => {
    queryClient.setQueryState(queryKey, {
      data: initialData || {
        pages: [],
        pageParams: [initialPageParam].filter(Boolean),
      },
      isFetching: false,
      error: undefined,
      isError: false,
      isSuccess: !!initialData,
    });
    fetchedCursorsRef.current.clear();
  }, [initialData, initialPageParam, queryClient, queryKey]);

  useEffect(() => {
    if (enabled === false) return;

    // Invalidate listener
    const unsubscribe = queryClient.onInvalidate(queryKey, () => {
      refetch();
    });

    const currentState = queryClient.getQueryState(queryKey);
    const staleTime = opts?.staleTime ?? 0;
    let shouldFetch = true;
    if (currentState?.isSuccess && currentState?.updatedAt) {
      if (Date.now() - currentState.updatedAt < staleTime) {
        shouldFetch = false;
      }
    }

    const data = currentState?.data as InfData<TPage> | undefined;
    const currentPagesLength = data?.pages?.length || 0;

    if (currentPagesLength === 0 && !initialData) {
      shouldFetch = true;
    }

    if (shouldFetch) refetch();

    return unsubscribe;
  }, [enabled, queryClient, queryKey, refetch, opts?.staleTime, initialData]);

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
    const refetchOnReconnect = opts?.refetchOnReconnect ?? true;
    if (!refetchOnReconnect) return;

    const handleOnline = () => {
      if (enabled === false) return;
      const currentState = queryClient.getQueryState(queryKey);
      const staleTime = opts?.staleTime ?? 0;
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
    enabled,
    opts?.staleTime,
    refetch,
    queryKey,
    queryClient,
  ]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    data: flattenedData,
    pages,
    pageParams,
    fetchNext,
    hasNext,
    isFetching: state.isFetching,
    isError: state.isError,
    isSuccess: state.isSuccess,
    error: state.error,
    refetch,
    reset,
  };
}
