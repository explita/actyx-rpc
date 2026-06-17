import {
  useCallback,
  useEffect,
  useRef,
  useId,
  useState,
  useSyncExternalStore,
} from "react";
import type { ErrorResponse, QueryResult } from "../../types/misc.js";
import type {
  InfiniteQueryPage,
  UseInfiniteQueryOpts,
  InfiniteQueryResult,
  WithoutCursor,
} from "../types.js";
import { useQueryClient } from "../provider.js";
import { globalRequestManager } from "../lib/request-manager.js";
import { parseWindow } from "../../lib/utils.js";

type InfData<TPage, TFullPage = InfiniteQueryPage<TPage>> = {
  pages: TFullPage[];
  pageParams: (string | number)[];
};

export function usePaginatedQuery<
  TFullPage extends InfiniteQueryPage<any>,
  TInput = any,
  TPage = TFullPage extends InfiniteQueryPage<infer P> ? P : never,
  TQueryKey extends unknown[] = unknown[],
>(
  proc: (input: WithoutCursor<TInput>) => Promise<QueryResult<TFullPage>>,
  opts: UseInfiniteQueryOpts<TInput, TPage, TQueryKey, TFullPage>,
): InfiniteQueryResult<TPage, TFullPage> {
  const queryClient = useQueryClient();
  const localId = useId();

  const queryKey = opts.queryKey
    ? opts.queryKey.map(String).join("|")
    : `__local_pag__${localId}`;

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

  const callbacksRef = useRef({
    onSuccess,
    onError,
    onSettled,
    proc,
    initialInput,
    initialData,
  });
  useEffect(() => {
    callbacksRef.current = {
      onSuccess,
      onError,
      onSettled,
      proc,
      initialInput,
      initialData,
    };
  });

  // Initialize cache
  if (!queryClient.getQueryState(queryKey)) {
    const resolvedInitialData =
      typeof initialData === "function" ? initialData() : initialData;
    queryClient.setQueryState(
      queryKey,
      {
        data: resolvedInitialData || {
          pages: [],
          pageParams: [initialPageParam].filter(Boolean),
        },
        error: undefined,
        isFetching: false,
        isError: false,
        isSuccess: !!resolvedInitialData,
        // updatedAt: resolvedInitialData ? Date.now() : undefined,
        isFetched: false,
      },
      { silent: true },
    );
  }

  const subscribe = useCallback(
    (onChange: () => void) =>
      queryClient.subscribe(queryKey, onChange, opts.gcTime),
    [queryClient, queryKey, opts.gcTime],
  );
  const getSnapshot = useCallback(
    () => queryClient.getQueryState(queryKey)!,
    [queryClient, queryKey],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const data = (state.data as InfData<TPage, TFullPage>) || {
    pages: [],
    pageParams: [],
  };
  const pages = data.pages;
  const pageParams = data.pageParams;

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchedCursorsRef = useRef<Set<string | number>>(new Set());
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const currentPage = pages[currentPageIndex];
  const currentPageData: TPage[] = currentPage
    ? Array.isArray(currentPage.data)
      ? currentPage.data
      : []
    : pages.length > 0 && Array.isArray(pages[0]?.data)
      ? pages[0].data
      : [];

  const hasNext =
    currentPageIndex < pages.length - 1 ||
    !!(
      currentPage &&
      (getNextPageParam?.(currentPage, pages) ?? currentPage.nextCursor)
    );
  const hasPrevious =
    currentPageIndex > 0 || !!(pages[0]?.previousCursor);

  const fetchPage = useCallback(
    async (cursor?: string | number): Promise<TFullPage> => {
      const fetcher = async () =>
        await callbacksRef.current.proc({
          ...callbacksRef.current.initialInput,
          cursor,
        } as TInput);

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
    // Cache hit: navigate to next already-loaded page
    if (currentPageIndex < pages.length - 1) {
      const targetIndex = currentPageIndex + 1;
      setCurrentPageIndex(targetIndex);

      // Background refetch if stale
      const staleMs = parseWindow(opts.staleTime);
      const isStale =
        staleMs === 0 || !state.updatedAt || Date.now() - state.updatedAt >= staleMs;
      if (isStale) {
        const targetCursor = pageParams[targetIndex];
        fetchPage(targetCursor).then((freshPage) => {
          const latestData = queryClient.getQueryState(queryKey)?.data as any;
          if (!latestData?.pages?.[targetIndex]) return;
          const newPages = [...latestData.pages];
          newPages[targetIndex] = freshPage;
          queryClient.setQueryState(queryKey, {
            data: { ...latestData, pages: newPages },
            updatedAt: Date.now(),
          });
        }).catch(() => {/* silently ignore background refetch errors */});
      }

      return pages[targetIndex];
    }

    // Nothing more to fetch
    if (!hasNext || state.isFetching) return undefined;
    queryClient.setQueryState(queryKey, { isFetching: true });

    const lastPage = pages[pages.length - 1];
    const nextCursor =
      getNextPageParam?.(lastPage, pages) ?? lastPage?.nextCursor;

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

        // Remove old cursors from fetched set
        const removedCursors = pageParams.slice(
          0,
          pageParams.length - maxPages + 1,
        );
        removedCursors.forEach((c) => fetchedCursorsRef.current.delete(c));

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
      setCurrentPageIndex(newPages.length - 1);
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
    }
  }, [
    currentPageIndex,
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

  const fetchPrevious = useCallback(async () => {
    // Cache hit: navigate to previous already-loaded page
    if (currentPageIndex > 0) {
      const targetIndex = currentPageIndex - 1;
      setCurrentPageIndex(targetIndex);

      // Background refetch if stale
      const staleMs = parseWindow(opts.staleTime);
      const isStale =
        staleMs === 0 || !state.updatedAt || Date.now() - state.updatedAt >= staleMs;
      if (isStale) {
        const targetCursor = pageParams[targetIndex];
        fetchPage(targetCursor).then((freshPage) => {
          const latestData = queryClient.getQueryState(queryKey)?.data as any;
          if (!latestData?.pages?.[targetIndex]) return;
          const newPages = [...latestData.pages];
          newPages[targetIndex] = freshPage;
          queryClient.setQueryState(queryKey, {
            data: { ...latestData, pages: newPages },
            updatedAt: Date.now(),
          });
        }).catch(() => {/* silently ignore background refetch errors */});
      }

      return pages[targetIndex];
    }

    // Nothing more to fetch
    if (!hasPrevious || state.isFetching) return undefined;
    queryClient.setQueryState(queryKey, { isFetching: true });

    const firstPage = pages[0];
    if (!firstPage) {
      queryClient.setQueryState(queryKey, { isFetching: false });
      return undefined;
    }

    const previousCursor = firstPage.previousCursor;

    if (!previousCursor || fetchedCursorsRef.current.has(previousCursor)) {
      queryClient.setQueryState(queryKey, { isFetching: false });
      return undefined;
    }

    try {
      const newPage = await fetchPage(previousCursor);
      fetchedCursorsRef.current.add(previousCursor);

      let newPages = [newPage, ...pages];
      let newParams = [previousCursor, ...pageParams];
      if (maxPages && newPages.length > maxPages) {
        newPages = newPages.slice(0, maxPages);

        // Remove old cursors from fetched set
        const removedCursors = pageParams.slice(maxPages - 1);
        removedCursors.forEach((c) => fetchedCursorsRef.current.delete(c));

        newParams = newParams.slice(0, maxPages);
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
      // Index stays at 0 — prepended page is now at index 0
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
    }
  }, [
    currentPageIndex,
    hasPrevious,
    state.isFetching,
    pages,
    pageParams,
    fetchPage,
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
        isFetched: true,
      });
      setCurrentPageIndex(0);
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
      // updatedAt: resolvedInitData ? Date.now() : undefined,
      isFetched: false,
    });
    setCurrentPageIndex(0);
    fetchedCursorsRef.current.clear();
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
    (item: TPage) => {
      return queryClient.prepend(queryKey, item);
    },
    [queryClient, queryKey],
  );

  const append = useCallback(
    (item: TPage) => {
      return queryClient.append(queryKey, item);
    },
    [queryClient, queryKey],
  );

  const insert = useCallback(
    (index: number, item: TPage) => {
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

  useEffect(() => {
    if (enabled === false) return;

    // Invalidate listener
    const unsubscribe = queryClient.onInvalidate(queryKey, () => {
      refetch();
    });

    const currentState = queryClient.getQueryState(queryKey);
    const staleTime = parseWindow(opts.staleTime);
    let shouldFetch = true;
    if (currentState?.isSuccess && currentState?.updatedAt) {
      if (Date.now() - currentState.updatedAt < staleTime) {
        shouldFetch = false;
      }
    }

    const currentData = currentState?.data as InfData<TPage> | undefined;
    if ((currentData?.pages?.length || 0) === 0) {
      shouldFetch = true;
    }

    if (shouldFetch) refetch();

    return unsubscribe;
  }, [enabled, queryClient, queryKey, refetch, opts?.staleTime]);

  // Clear fetched cursors when queryKey changes
  useEffect(() => {
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
    const refetchOnReconnect = opts?.refetchOnReconnect ?? true;
    if (!refetchOnReconnect) return;

    const handleOnline = () => {
      if (enabled === false) return;
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

  const isRefetching = state.isFetching && pages.length > 0;

  const isEmpty = state.isFetched && currentPageData.length === 0;

  return {
    data: currentPageData,
    pages,
    pageParams,
    fetchNext,
    fetchPrevious,
    hasNext,
    hasPrevious,
    isFetching: state.isFetching,
    isRefetching,
    isError: state.isError,
    isSuccess: state.isSuccess,
    error: state.error,
    isFetched: state.isFetched,
    isEmpty,
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
