import { useCallback, useEffect, useRef, useState } from "react";
import type { ErrorResponse, QueryResult } from "../../types/misc.js";
import type {
  InfiniteQueryPage,
  UseInfiniteQueryOpts,
  UseInfiniteQueryReturn,
  WithoutCursor,
} from "../types.js";

export function usePaginatedQuery<TInput, TPage, TContext = unknown>(
  proc: (
    input: WithoutCursor<TInput>,
  ) => Promise<QueryResult<InfiniteQueryPage<TPage>>>,
  opts: UseInfiniteQueryOpts<TInput, TPage>,
): UseInfiniteQueryReturn<TPage, TContext> {
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
  const [isFetching, setIsFetching] = useState(false);
  const [context, setContext] = useState<TContext | undefined>();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
  const hasPrevious = pages.length > 1 || !!pageParams[0];

  const fetchPage = useCallback(
    async (cursor?: string | number): Promise<InfiniteQueryPage<TPage>> => {
      // Skip if already fetching this cursor
      if (cursor !== undefined && fetchedCursorsRef.current.has(cursor)) {
        const existingPageIndex = pageParams.indexOf(cursor);
        if (existingPageIndex !== -1) {
          return pages[existingPageIndex];
        }
      }

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

      // Mark as fetched
      if (cursor !== undefined) {
        fetchedCursorsRef.current.add(cursor);
      }

      return result;
    },
    [proc, initialInput, pageParams, pages],
  );

  const fetchNext = useCallback(async () => {
    if (!hasNext) return undefined;
    if (isFetching) return undefined;

    setIsFetching(true);

    const lastPage = pages[pages.length - 1];
    const nextCursor = getNextPageParam?.(lastPage) ?? lastPage?.nextCursor;

    if (!nextCursor) {
      setIsFetching(false);
      return undefined;
    }

    // Check if already fetched
    if (fetchedCursorsRef.current.has(nextCursor)) {
      setIsFetching(false);
      return undefined;
    }

    try {
      const newPage = await fetchPage(nextCursor);

      setPages((prev) => {
        let newPages = [...prev, newPage];
        if (maxPages && newPages.length > maxPages) {
          newPages = newPages.slice(-maxPages);
          // Remove old cursors from fetched set
          const removedCursors = pageParams.slice(
            0,
            pageParams.length - maxPages + 1,
          );
          removedCursors.forEach((c) => fetchedCursorsRef.current.delete(c));
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

      setIsFetching(false);
      onSuccess?.({
        pages: [...pages, newPage],
        pageParams: [...pageParams, nextCursor],
      });
      onSettled?.();

      return newPage;
    } catch (err) {
      setIsFetching(false);
      onError?.(err as ErrorResponse);
      onSettled?.();
      return undefined;
    }
  }, [
    pages,
    pageParams,
    hasNext,
    isFetching,
    fetchPage,
    getNextPageParam,
    maxPages,
    onSuccess,
    onError,
    onSettled,
  ]);

  const fetchPrevious = useCallback(async () => {
    if (!hasPrevious) return undefined;
    if (isFetching) return undefined;

    setIsFetching(true);

    // Get the previous cursor based on the first page's cursor value
    // We need to know what cursor to fetch for the page BEFORE the first one
    const firstPage = pages[0];
    if (!firstPage) {
      setIsFetching(false);
      return undefined;
    }

    // For previous page, we need to know what cursor to use
    // This typically comes from a "previousCursor" field.
    const previousCursor = firstPage.previousCursor;

    if (!previousCursor) {
      setIsFetching(false);
      return undefined;
    }

    // Check if already fetched
    if (fetchedCursorsRef.current.has(previousCursor)) {
      setIsFetching(false);
      return undefined;
    }

    try {
      const newPage = await fetchPage(previousCursor);

      setPages((prev) => {
        let newPages = [newPage, ...prev];
        if (maxPages && newPages.length > maxPages) {
          newPages = newPages.slice(0, maxPages);
          // Remove old cursors from fetched set
          const removedCursors = pageParams.slice(maxPages - 1);
          removedCursors.forEach((c) => fetchedCursorsRef.current.delete(c));
        }
        return newPages;
      });

      setPageParams((prev) => {
        let newParams = [previousCursor, ...prev];
        if (maxPages && newParams.length > maxPages) {
          newParams = newParams.slice(0, maxPages);
        }
        return newParams;
      });

      setIsFetching(false);
      onSuccess?.({
        pages: [newPage, ...pages],
        pageParams: [previousCursor, ...pageParams],
      });
      onSettled?.();

      return newPage;
    } catch (err) {
      setIsFetching(false);
      onError?.(err as ErrorResponse);
      onSettled?.();
      return undefined;
    }
  }, [
    pages,
    pageParams,
    hasPrevious,
    isFetching,
    fetchPage,
    maxPages,
    onSuccess,
    onError,
    onSettled,
  ]);

  const refetch = useCallback(async () => {
    setIsFetching(true);
    setError(undefined);

    try {
      const firstPage = await fetchPage(initialPageParam);
      setPages([firstPage]);
      setPageParams([initialPageParam].filter(Boolean) as (number | string)[]);
      onSuccess?.({
        pages: [firstPage],
        pageParams: [initialPageParam].filter(Boolean) as (string | number)[],
      });
    } catch (err) {
      setError(err as ErrorResponse);
      onError?.(err as ErrorResponse);
    } finally {
      setIsFetching(false);
      onSettled?.();
    }
  }, [fetchPage, initialPageParam, onSuccess, onError, onSettled]);

  const reset = useCallback(() => {
    setPages(initialData?.pages || []);
    setPageParams(
      initialData?.pageParams ||
        ([initialPageParam].filter(Boolean) as (number | string)[]),
    );
    setError(undefined);
    setIsFetching(false);
    setContext(undefined);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [initialData, initialPageParam]);

  // Initial fetch
  useEffect(() => {
    if (enabled === false) {
      return;
    }

    if (pages.length === 0 && !initialData) {
      refetch();
    }
  }, [enabled, initialData, pages.length, refetch]);

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
      if (enabled !== false && pages.length > 0) {
        refetch();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetchOnWindowFocus, enabled, pages.length, refetch]);

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
    fetchPrevious,
    hasNext,
    hasPrevious,
    isFetching,
    isError: !!error,
    isSuccess: !error && pages.length > 0,
    error,
    refetch,
    reset,
    context,
  };
}
