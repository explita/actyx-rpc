import type { ErrorResponse } from "../../types/misc.js";
import { useCallback, useEffect, useRef, useState } from "react";

type UseQueryOpts<TOutput> = {
  enabled?: boolean;
  initialData?: Omit<TOutput, "success">;
  onSuccess?: (data: TOutput) => void;
  onError?: (error: ErrorResponse) => void;
  onSettled?: (data: TOutput | null, error: ErrorResponse | null) => void;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
};

// Conditional return type based on initialData presence
type QueryResult<TOutput, TInitialData> = {
  data: TInitialData extends undefined ? TOutput | undefined : TOutput;
  error: ErrorResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: TInitialData extends undefined
    ? () => Promise<TOutput | undefined>
    : () => Promise<TOutput>;
  reset: () => void;
};

export function useQuery<TOutput, TInitialData = undefined>(
  proc: () => Promise<[TOutput, null] | [null, ErrorResponse]>,
  opts: UseQueryOpts<TOutput> & { initialData?: TInitialData } = {
    enabled: true,
    refetchOnWindowFocus: false,
    refetchInterval: 0,
  },
): QueryResult<TOutput, TInitialData> {
  //@ts-ignore
  const [data, setData] = useState<TOutput | undefined>(opts?.initialData);
  const [error, setError] = useState<ErrorResponse | undefined>();
  const [isFetching, setIsFetching] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    setIsFetching(true);

    const [result, err] = await proc();

    if (err) {
      setError(err);
      //@ts-ignore
      setData(opts?.initialData);
      opts?.onError?.(err);
    } else {
      setData(result);
      setError(undefined);
      opts?.onSuccess?.(result);
    }

    setIsFetching(false);
    opts?.onSettled?.(result, err);

    return result;
  }, [proc]);

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
  }, [opts?.enabled]);

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
  } as QueryResult<TOutput, TInitialData>;
}
