import { useEffect, useId, useRef } from "react";
import { useQuery } from "./use-query.js";
import { UseQueryOpts, Unwrap, UseSuspenseQueryResult } from "../types.js";
import { ErrorResponse } from "../../types/misc.js";
import { globalRequestManager } from "../lib/request-manager.js";

export function useSuspenseQuery<
  TOutput,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
>(
  proc: () => Promise<[TOutput, null] | [null, ErrorResponse]>,
  opts?: Omit<
    UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData>,
    "initialData" | "enabled"
  >,
): UseSuspenseQueryResult<TOutput, TUnwrap, TSelectData> {
  const localId = useId();

  // Match useQuery's key computation exactly
  const queryKeyStr = opts?.queryKey
    ? opts.queryKey
        .map((i) =>
          typeof i === "object" && i !== null ? JSON.stringify(i) : String(i),
        )
        .join("|")
    : `__local__${localId}`;

  const result = useQuery<TOutput, TQueryKey, TUnwrap, undefined, TSelectData>(
    proc,
    { ...opts, enabled: true, initialData: undefined },
  );

  // Track whether useQuery has initiated its first fetch via useEffect.
  // On the very first render, useQuery's fetch hasn't started yet (effects are
  // deferred), so data will be undefined but no promise exists to throw.
  // We render an empty state for that single frame and let React suspend on
  // the next render after the effect fires.
  const fetchStartedRef = useRef(false);
  useEffect(() => {
    fetchStartedRef.current = true;
  });

  // Throw error to nearest ErrorBoundary
  if (result.isError && result.error) {
    throw result.error;
  }

  if (result.data === undefined) {
    // Check if useQuery's fetch is in-flight (non-local keys use globalRequestManager)
    const activePromise = globalRequestManager.getActivePromise(queryKeyStr);

    if (activePromise) {
      // Throw the existing in-flight promise — React will suspend until it resolves.
      // The same promise reference is thrown every render, preventing infinite loops.
      throw activePromise;
    }

    if (fetchStartedRef.current) {
      // useQuery's effect has fired and a fetch is in progress, but the promise
      // isn't in the global request manager (local key or already resolved).
      // Fall back to refetch and throw its promise.
      throw result.refetch();
    }

    // First render, no fetch started yet — return default state for one frame.
    // The useEffect will trigger a fetch, and the next render will throw.
    return result as UseSuspenseQueryResult<TOutput, TUnwrap, TSelectData>;
  }

  return result as UseSuspenseQueryResult<TOutput, TUnwrap, TSelectData>;
}
