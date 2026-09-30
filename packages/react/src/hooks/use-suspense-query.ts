"use client";

import { useEffect, useId, useRef } from "react";
import { useQuery } from "./use-query.js";
import type {
  UseQueryOpts,
  Unwrap,
  UseSuspenseQueryResult,
  ExtractProcOutput,
  ExtractProcInput,
  ExtractProcArgs,
  HasRequiredKeys,
} from "../types/main.js";
import { globalRequestManager } from "../lib/request-manager.js";

/**
 * React Suspense hook for executing and caching an Actyx RPC query procedure (with input schema).
 *
 * Suspends the rendering component until the query promise resolves, and propagates
 * failures directly to the nearest React `ErrorBoundary`. Returned `data` is guaranteed
 * to be defined when the component renders.
 *
 * @template TProc - The RPC procedure function.
 * @template TInput - Inferred input payload type accepted by the procedure.
 * @template TArgs - Inferred extra positional arguments accepted by the procedure.
 * @template TOutput - Inferred resolved data type returned by the procedure.
 * @template TQueryKey - Tuple type of the query cache key.
 * @template TUnwrap - Boolean flag indicating whether to unwrap the `{ data }` payload.
 * @template TSelectData - Transformed data type if a `select` transformer is supplied.
 *
 * @param proc - The RPC query procedure to execute.
 * @param opts - Query options including `input` (excluding `initialData` and `enabled`, which are managed by Suspense).
 * @param extraArgs - Additional positional arguments forwarded to the procedure call.
 * @returns A `UseSuspenseQueryResult` object with guaranteed non-null `data` and query controls.
 *
 * @example
 * ```tsx
 * function UserProfile({ id }: { id: string }) {
 *   const { data } = useSuspenseQuery(getUser, {
 *     input: { id },
 *     queryKey: ["user", id],
 *   });
 *
 *   return <div>Hello {data.name}</div>;
 * }
 * ```
 */
export function useSuspenseQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TInput = ExtractProcInput<TProc>,
  TArgs extends unknown[] = ExtractProcArgs<TProc>,
  TOutput = ExtractProcOutput<TProc>,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
>(
  proc: TProc,
  opts: [TInput] extends [void | undefined | never]
    ? never
    : (HasRequiredKeys<TInput> extends true
        ? Omit<
            UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData, NoInfer<TInput>>,
            "initialData" | "enabled"
          > & {
            input: NoInfer<TInput>;
          }
        : Omit<
            UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData, NoInfer<TInput>>,
            "initialData" | "enabled"
          > & {
            input?: NoInfer<TInput>;
          }),
  ...extraArgs: NoInfer<TArgs>
): UseSuspenseQueryResult<TOutput, TUnwrap, TSelectData>;

/**
 * React Suspense hook for executing and caching an Actyx RPC query procedure (without input schema).
 *
 * Suspends the rendering component until the query promise resolves, and propagates
 * failures directly to the nearest React `ErrorBoundary`. Returned `data` is guaranteed
 * to be defined when the component renders.
 *
 * @template TProc - The RPC procedure function.
 * @template TInput - Inferred input payload type (`undefined` for procedures without input schema).
 * @template TArgs - Inferred positional arguments accepted by the procedure.
 * @template TOutput - Inferred resolved data type returned by the procedure.
 * @template TQueryKey - Tuple type of the query cache key.
 * @template TUnwrap - Boolean flag indicating whether to unwrap the `{ data }` payload.
 * @template TSelectData - Transformed data type if a `select` transformer is supplied.
 *
 * @param proc - The RPC query procedure to execute.
 * @param opts - Query options (excluding `initialData` and `enabled`, which are managed by Suspense).
 * @param extraArgs - Positional arguments forwarded to the procedure call.
 * @returns A `UseSuspenseQueryResult` object with guaranteed non-null `data` and query controls.
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const { data } = useSuspenseQuery(getOverview, {
 *     queryKey: ["overview"],
 *   });
 *
 *   return <div>Overview data: {data.total}</div>;
 * }
 * ```
 */
export function useSuspenseQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TInput = ExtractProcInput<TProc>,
  TArgs extends unknown[] = ExtractProcArgs<TProc>,
  TOutput = ExtractProcOutput<TProc>,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
>(
  proc: TProc,
  opts?: [TInput] extends [void | undefined | never]
    ? Omit<
        UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData, undefined>,
        "initialData" | "enabled"
      > & {
        input?: undefined;
      }
    : never,
  ...extraArgs: NoInfer<TArgs>
): UseSuspenseQueryResult<TOutput, TUnwrap, TSelectData>;

export function useSuspenseQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TInput = ExtractProcInput<TProc>,
  TArgs extends unknown[] = ExtractProcArgs<TProc>,
  TOutput = ExtractProcOutput<TProc>,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
>(
  proc: TProc,
  opts?: any,
  ...extraArgs: any[]
): UseSuspenseQueryResult<TOutput, TUnwrap, TSelectData> {
  const localId = useId();

  const serializedInput =
    opts?.input !== undefined
      ? typeof opts.input === "object" && opts.input !== null
        ? JSON.stringify(opts.input)
        : String(opts.input)
      : "";

  const serializedExtraArgs =
    extraArgs.length > 0
      ? extraArgs
          .map((i: any) =>
            typeof i === "object" && i !== null ? JSON.stringify(i) : String(i),
          )
          .join("|")
      : "";

  // Match useQuery's key computation exactly
  const queryKeyStr = opts?.queryKey
    ? opts.queryKey
        .map((i: any) =>
          typeof i === "object" && i !== null ? JSON.stringify(i) : String(i),
        )
        .join("|")
    : serializedInput || serializedExtraArgs
      ? `__local__${localId}|${[serializedInput, serializedExtraArgs].filter(Boolean).join("|")}`
      : `__local__${localId}`;

  const result = (useQuery as any)(
    proc,
    {
      ...opts,
      enabled: true,
      initialData: undefined,
    },
    ...extraArgs,
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
