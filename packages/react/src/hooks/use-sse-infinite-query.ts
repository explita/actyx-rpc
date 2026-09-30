"use client";

import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "./use-infinite-query.js";
import type {
  ExtractInfiniteItem,
  ExtractInfinitePage,
  ExtractProcArgs,
  ExtractProcInput,
  HasRequiredKeys,
  Prettify,
  SSEAdapterOptions,
  UseInfiniteQueryOpts,
  UseSSEInfiniteQueryResult,
  WithoutCursor,
  PaginationArgs,
} from "../types/main.js";
import { useSSE } from "./use-sse.js";

/**
 * React hook that combines infinite query pagination with real-time Server-Sent Events (Procedure with input schema).
 *
 * Fetches historical paginated data using `useInfiniteQuery` and automatically prepends or appends
 * incoming live events from an SSE stream into the query cache.
 *
 * @template TProc - The paginated query procedure function.
 * @template TInput - Input schema payload type.
 * @template TArgs - Inferred additional arguments accepted by the procedure.
 * @template TFullPage - Full page payload returned by each fetch.
 * @template TPage - Individual item type extracted from the paginated collection.
 * @template TQueryKey - Tuple type of the query cache key.
 * @template TData - Parsed SSE event data type.
 *
 * @param queryProcedure - The paginated query procedure.
 * @param opts - Combined options for SSE connection (`url`, `headers`, `onData`) and infinite query (`queryOpts.input`, `getNextPageParam`).
 * @param extraArgs - Additional positional arguments forwarded to the procedure call.
 * @returns An infinite query result augmented with SSE connection controls (`isConnected`, `close`, `lastData`).
 *
 * @example
 * ```tsx
 * const { data, isConnected, fetchNextPage } = useSSEInfiniteQuery(
 *   getNotifications,
 *   {
 *     url: "/api/notifications/stream",
 *     queryOpts: {
 *       input: { unreadOnly: true },
 *       getNextPageParam: (page) => page.nextCursor,
 *     },
 *   }
 * );
 * ```
 */
export function useSSEInfiniteQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TInput = ExtractProcInput<TProc>,
  TArgs extends unknown[] = ExtractProcArgs<TProc>,
  TFullPage = ExtractInfinitePage<TProc>,
  TPage = ExtractInfiniteItem<TFullPage>,
  TQueryKey extends unknown[] = unknown[],
  TData = TPage,
>(
  queryProcedure: TProc,
  opts: [TInput] extends [void | undefined | never]
    ? never
    : HasRequiredKeys<WithoutCursor<TInput>> extends true
      ? Prettify<
          Omit<
            SSEAdapterOptions<
              NoInfer<TInput>,
              TData,
              TPage,
              TQueryKey,
              TFullPage,
              NoInfer<TArgs>
            >,
            "queryOpts"
          > & {
            queryOpts: Omit<
              UseInfiniteQueryOpts<
                NoInfer<TInput>,
                TPage,
                TQueryKey,
                TFullPage,
                NoInfer<TArgs>
              >,
              "arrange"
            > & {
              input:
                | WithoutCursor<NoInfer<TInput>>
                | NoInfer<TInput>
                | ((pageParam: any) => NoInfer<TInput>);
            };
          }
        >
      : Prettify<
          Omit<
            SSEAdapterOptions<
              NoInfer<TInput>,
              TData,
              TPage,
              TQueryKey,
              TFullPage,
              NoInfer<TArgs>
            >,
            "queryOpts"
          > & {
            queryOpts?: Omit<
              UseInfiniteQueryOpts<
                NoInfer<TInput>,
                TPage,
                TQueryKey,
                TFullPage,
                NoInfer<TArgs>
              >,
              "arrange"
            > & {
              input?:
                | WithoutCursor<NoInfer<TInput>>
                | NoInfer<TInput>
                | ((pageParam: any) => NoInfer<TInput>);
            };
          }
        >,
  ...extraArgs: NoInfer<TArgs>
): UseSSEInfiniteQueryResult<TPage, TFullPage, TData>;

/**
 * React hook that combines infinite query pagination with real-time Server-Sent Events (Procedure without input schema).
 *
 * When a procedure defines no input schema, pagination parameters are supplied via trailing arguments.
 *
 * @template TProc - The paginated query procedure function.
 * @template TArgs - Inferred positional arguments accepted by the procedure.
 * @template TFullPage - Full page payload returned by each fetch.
 * @template TPage - Individual item type extracted from the paginated collection.
 * @template TQueryKey - Tuple type of the query cache key.
 * @template TData - Parsed SSE event data type.
 *
 * @param queryProcedure - The paginated query procedure.
 * @param opts - Combined options for SSE connection (`url`, `onData`) and infinite query (`queryOpts.getNextPageParam`).
 * @param extraArgs - Positional arguments passed to the procedure call (e.g. pagination options).
 * @returns An infinite query result augmented with SSE connection controls.
 */
export function useSSEInfiniteQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TInput = ExtractProcInput<TProc>,
  TArgs extends unknown[] = ExtractProcArgs<TProc>,
  TFullPage = ExtractInfinitePage<TProc>,
  TPage = ExtractInfiniteItem<TFullPage>,
  TQueryKey extends unknown[] = unknown[],
  TData = TPage,
>(
  queryProcedure: TProc,
  opts: [TInput] extends [void | undefined | never]
    ? Prettify<
        Omit<
          SSEAdapterOptions<
            undefined,
            TData,
            TPage,
            TQueryKey,
            TFullPage,
            NoInfer<PaginationArgs<TArgs>>
          >,
          "queryOpts"
        > & {
          queryOpts?: Omit<
            UseInfiniteQueryOpts<
              undefined,
              TPage,
              TQueryKey,
              TFullPage,
              NoInfer<PaginationArgs<TArgs>>
            >,
            "arrange"
          > & {
            input?: undefined;
          };
        }
      >
    : never,
  ...extraArgs: NoInfer<PaginationArgs<TArgs>>
): UseSSEInfiniteQueryResult<TPage, TFullPage, TData>;

export function useSSEInfiniteQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TFullPage = ExtractInfinitePage<TProc>,
  TPage = ExtractInfiniteItem<TFullPage>,
  TInput = any,
  TQueryKey extends unknown[] = unknown[],
  TData = TPage,
  TArgs extends unknown[] = any[],
>(queryProcedure: any, opts: any, ...extraArgs: any[]): any {
  const { queryOpts, onData, arrange, ...sseOpts } = opts || {};

  const optsRef = useRef({ onData, arrange });
  useEffect(() => {
    optsRef.current = { arrange, onData };
  });

  // 1. Instantiate the paginated query, forwarding extraArgs
  const queryResult = (useInfiniteQuery as any)(
    queryProcedure,
    queryOpts,
    ...extraArgs,
  );

  // 2. Attach SSE listener spreading all sseOpts
  const sseResult = useSSE<TData>({
    ...sseOpts,
    enabled: sseOpts.enabled ?? true,
    onData: (data, event) => {
      if (optsRef.current.onData) {
        optsRef.current.onData({
          data,
          allData: queryResult.data as unknown as TData[],
          action: "added",
          append: queryResult.append as any,
          prepend: queryResult.prepend as any,
          update: queryResult.update as any,
          insert: queryResult.insert as any,
          event,
        });
      } else {
        queryResult.append(data as any);
      }
    },
  });

  const arrangedData = useMemo(() => {
    if (optsRef.current.arrange) {
      return optsRef.current.arrange(queryResult.data as unknown as TData[]);
    }
    return queryResult.data;
  }, [queryResult.data]);

  return {
    ...queryResult,
    data: arrangedData,
    error: sseResult.error || queryResult.error,
    lastData: sseResult.lastData,
    event: sseResult.event,
    isConnected: sseResult.isConnected,
    close: sseResult.close,
    clear: sseResult.clear,
  };
}
