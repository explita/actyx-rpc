import type { ErrorResponse } from "../../types/misc.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { globalRequestManager } from "../lib/request-manager.js";
import { QueryResult, Unwrap, UseQueryOpts } from "../types.js";

export function useQuery<
  TOutput,
  TInitialData = undefined,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
>(
  proc: () => Promise<[TOutput, null] | [null, ErrorResponse]>,
  opts: UseQueryOpts<TOutput, TQueryKey, TUnwrap> & {
    initialData?: TInitialData;
  } = {
    enabled: true,
    refetchOnWindowFocus: false,
    refetchInterval: 0,
    unwrap: false as TUnwrap,
  },
): QueryResult<TOutput, TInitialData, TUnwrap> {
  //@ts-ignore
  const [data, setData] = useState<Unwrap<TOutput, TUnwrap> | undefined>(
    opts?.initialData as Unwrap<TOutput, TUnwrap>,
  );
  const [error, setError] = useState<ErrorResponse | undefined>();
  const [isFetching, setIsFetching] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Store callbacks in a ref to avoid re-creating fetchData when they change
  const callbacksRef = useRef({
    onSuccess: opts?.onSuccess,
    onError: opts?.onError,
    onSettled: opts?.onSettled,
    initialData: opts?.initialData,
  });

  useEffect(() => {
    callbacksRef.current = {
      onSuccess: opts?.onSuccess,
      onError: opts?.onError,
      onSettled: opts?.onSettled,
      initialData: opts?.initialData,
    };
  });

  const queryKey = opts.queryKey?.map((i) => String(i)).join("|") ?? "";

  const fetchData = useCallback(async () => {
    setIsFetching(true);

    let resultTuple: [TOutput, null] | [null, ErrorResponse];

    // Wrap proc to pass progress if it supports it
    const fetcher = async () => {
      return await proc();
    };

    if (queryKey) {
      resultTuple = await globalRequestManager.fetch(queryKey, fetcher);
    } else {
      resultTuple = await fetcher();
    }

    const [result, err] = resultTuple;

    if (err) {
      setError(err);
      //@ts-ignore
      setData(callbacksRef.current.initialData);
      callbacksRef.current.onError?.(err);
    } else {
      const unwrapped =
        opts.unwrap === true &&
        result &&
        //@ts-ignore
        "data" in result
          ? //@ts-ignore
            result.data
          : result;
      setData(unwrapped as any);
      setError(undefined);
      callbacksRef.current.onSuccess?.(result);
    }

    setIsFetching(false);
    callbacksRef.current.onSettled?.(result, err);

    return result;
  }, [proc, queryKey]); // Only depend on stable parts of opts

  const refetch = useCallback(fetchData, [fetchData]);

  const reset = useCallback(() => {
    //@ts-ignore
    setData(opts?.initialData);
    setError(undefined);
    setIsFetching(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [opts?.initialData]);

  // Initial fetch
  useEffect(() => {
    if (opts?.enabled === false) {
      return;
    }

    fetchData();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [opts?.enabled, fetchData, queryKey]);

  // Refetch interval (only if data exists or initialData provided)
  useEffect(() => {
    if (opts?.refetchInterval && opts.enabled !== false) {
      intervalRef.current = setInterval(() => refetch(), opts.refetchInterval);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [opts?.refetchInterval, opts?.enabled, data, refetch]);

  // Refetch on window focus
  useEffect(() => {
    if (!opts?.refetchOnWindowFocus) return;

    const handleFocus = () => refetch();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [opts?.refetchOnWindowFocus, refetch]);

  return {
    error,
    isFetching,
    isError: !!error,
    isSuccess: !!data && !error && !isFetching,
    refetch,
    reset,
    data,
  } as QueryResult<TOutput, TInitialData, TUnwrap>;
}
