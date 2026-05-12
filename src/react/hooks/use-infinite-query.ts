import { useCallback, useEffect, useRef, useState } from "react";
import type { ErrorResponse, QueryResult } from "../../types/misc.js";
import type {
  InfiniteQueryPage,
  UseInfiniteQueryOpts,
  UseInfiniteQueryReturn,
  WithoutCursor,
} from "../types.js";

export function useInfiniteQuery<TInput, TPage, TContext = unknown>(
  proc: (
    input: WithoutCursor<TInput>,
  ) => Promise<QueryResult<InfiniteQueryPage<TPage>>>,
  opts: UseInfiniteQueryOpts<TInput, TPage>,
): Omit<
  UseInfiniteQueryReturn<TPage, TContext>,
  "fetchPrevious" | "hasPrevious" | "isFetchingPrevious" | "previousCursor"
> {
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

  // Store pages as a simple array
  const [pages, setPages] = useState<InfiniteQueryPage<TPage>[]>(
    initialData?.pages || [],
  );
  const [pageParams, setPageParams] = useState<(string | number)[]>(
    initialData?.pageParams ||
      ([initialPageParam].filter(Boolean) as (number | string)[]),
  );
  const [error, setError] = useState<ErrorResponse | undefined>();
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const [context, setContext] = useState<TContext | undefined>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Store callbacks in a ref to avoid re-creating stable functions when they change
  const callbacksRef = useRef({
    onSuccess,
    onError,
    onSettled,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSuccess,
      onError,
      onSettled,
    };
  });

  // Track fetched cursors to prevent duplicate fetches
  const fetchedCursorsRef = useRef<Set<string | number>>(new Set());

  // Computed values
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
      const abortController = new AbortController();
      abortControllerRef.current?.abort();
      abortControllerRef.current = abortController;

      const [result, err] = await proc({ ...initialInput, cursor });

      if (abortController.signal.aborted) {
        throw new Error("Aborted");
      }

      if (err) {
        setError(err);
        throw err;
      }

      return result;
    },
    [proc, initialInput],
  );

  const fetchNext = useCallback(async () => {
    if (!hasNext) return undefined;
    if (isFetchingNext) return undefined;

    setIsFetchingNext(true);

    const lastPage = pages[pages.length - 1];
    const nextCursor = getNextPageParam?.(lastPage) ?? lastPage?.nextCursor;

    if (!nextCursor) {
      setIsFetchingNext(false);
      return undefined;
    }

    try {
      const newPage = await fetchPage(nextCursor);

      setPages((prev) => {
        let newPages = [...prev, newPage];
        if (maxPages && newPages.length > maxPages) {
          newPages = newPages.slice(-maxPages);
        }
        return newPages;
      });

      setPageParams((prev) => {
        let newParams = [...prev, nextCursor];
        if (maxPages && newParams.length > maxPages) {
          newParams = newParams.slice(-maxPages);
        }
        return newParams;
      });

      setIsFetchingNext(false);
      callbacksRef.current.onSuccess?.({
        pages: [...pages, newPage],
        pageParams: [...pageParams, nextCursor],
      });
      callbacksRef.current.onSettled?.();

      return newPage;
    } catch (err) {
      setIsFetchingNext(false);
      callbacksRef.current.onError?.(err as ErrorResponse);
      callbacksRef.current.onSettled?.();
      return undefined;
    }
  }, [
    pages,
    pageParams,
    hasNext,
    isFetchingNext,
    fetchPage,
    getNextPageParam,
    maxPages,
  ]);

  const refetch = useCallback(async () => {
    setIsFetchingNext(true);
    setError(undefined);
    fetchedCursorsRef.current.clear();

    try {
      const firstPage = await fetchPage(initialPageParam);
      setPages([firstPage]);
      setPageParams([initialPageParam].filter(Boolean) as (number | string)[]);
      callbacksRef.current.onSuccess?.({
        pages: [firstPage],
        pageParams: [initialPageParam].filter(Boolean) as (string | number)[],
      });
    } catch (err) {
      setError(err as ErrorResponse);
      callbacksRef.current.onError?.(err as ErrorResponse);
    } finally {
      setIsFetchingNext(false);
      callbacksRef.current.onSettled?.();
    }
  }, [fetchPage, initialPageParam]);

  const reset = useCallback(() => {
    setPages(initialData?.pages || []);
    setPageParams(
      initialData?.pageParams ||
        ([initialPageParam].filter(Boolean) as (number | string)[]),
    );
    setError(undefined);
    setIsFetchingNext(false);
    setContext(undefined);
    fetchedCursorsRef.current.clear();
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [initialData, initialPageParam]);

  // Initial fetch
  useEffect(() => {
    if (enabled === false) {
      return;
    }

    refetch();
  }, [enabled, refetch]);

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
      if (enabled !== false) {
        refetch();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchOnWindowFocus, enabled, refetch]);

  // Cleanup
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    data: flattenedData,
    pages,
    pageParams,
    fetchNext,
    hasNext,
    isFetching: isFetchingNext,
    isError: !!error,
    isSuccess: !error && pages.length > 0,
    error,
    refetch,
    reset,
    context,
  };
}
