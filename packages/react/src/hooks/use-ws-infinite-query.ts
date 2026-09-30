"use client";

import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "./use-infinite-query.js";
import { useWS } from "./use-ws.js";
import type {
  ExtractInfiniteItem,
  ExtractInfinitePage,
  ExtractProcArgs,
  ExtractProcInput,
  HasRequiredKeys,
  InfiniteQueryPage,
  Prettify,
  UseInfiniteQueryOpts,
  UseWSInfiniteQueryResult,
  WithoutCursor,
  WSAdapterOptions,
  PaginationArgs,
} from "../types/main.js";

/**
 * React hook that combines infinite query pagination with real-time WebSocket streaming (Procedure with input schema).
 *
 * Fetches historical paginated data using `useInfiniteQuery` and automatically streams incoming messages
 * from a WebSocket connection directly into the query cache (prepended or appended).
 *
 * @template TProc - The paginated query procedure function.
 * @template TInput - Input schema payload type.
 * @template TArgs - Inferred additional arguments accepted by the procedure.
 * @template TFullPage - Full page payload returned by each fetch.
 * @template TPage - Individual item type extracted from the paginated collection.
 * @template TQueryKey - Tuple type of the query cache key.
 * @template TData - Incoming WebSocket message data type.
 *
 * @param queryProcedure - The paginated query procedure.
 * @param opts - Combined options for WebSocket connection (`url`, `onMessage`) and infinite query (`queryOpts.input`, `getNextPageParam`).
 * @param extraArgs - Additional positional arguments forwarded to the procedure call.
 * @returns An infinite query result augmented with WebSocket messaging controls (`send`, `status`, `unsubscribe`).
 *
 * @example
 * ```tsx
 * const { data, send, fetchNextPage, status } = useWSInfiniteQuery(
 *   getChatMessages,
 *   {
 *     url: "wss://api.example.com/chat/stream",
 *     queryOpts: {
 *       input: { roomId: "general" },
 *       getNextPageParam: (page) => page.nextCursor,
 *     },
 *   }
 * );
 * ```
 */
export function useWSInfiniteQuery<
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
            WSAdapterOptions<
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
            WSAdapterOptions<
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
): UseWSInfiniteQueryResult<TPage, TFullPage, TData>;

/**
 * React hook that combines infinite query pagination with real-time WebSocket streaming (Procedure without input schema).
 *
 * When a procedure defines no input schema, pagination parameters are supplied via trailing arguments.
 *
 * @template TProc - The paginated query procedure function.
 * @template TArgs - Inferred positional arguments accepted by the procedure.
 * @template TFullPage - Full page payload returned by each fetch.
 * @template TPage - Individual item type extracted from the paginated collection.
 * @template TQueryKey - Tuple type of the query cache key.
 * @template TData - Incoming WebSocket message data type.
 *
 * @param queryProcedure - The paginated query procedure.
 * @param opts - Combined options for WebSocket connection (`url`, `onMessage`) and infinite query (`queryOpts.getNextPageParam`).
 * @param extraArgs - Positional arguments passed to the procedure call (e.g. pagination options).
 * @returns An infinite query result augmented with WebSocket messaging controls.
 */
export function useWSInfiniteQuery<
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
          WSAdapterOptions<
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
): UseWSInfiniteQueryResult<TPage, TFullPage, TData>;

export function useWSInfiniteQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TFullPage = ExtractInfinitePage<TProc>,
  TPage = ExtractInfiniteItem<TFullPage>,
  TInput = any,
  TQueryKey extends unknown[] = unknown[],
  TData = TPage,
  TArgs extends unknown[] = any[],
>(queryProcedure: any, opts: any, ...extraArgs: any[]): any {
  const { queryOpts, onData, arrange, onWindowFocus, onReconnect, ...wsOpts } =
    opts || {};

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

  // 2. Attach WebSocket listener
  const wsResult = useWS<TData, TData>({
    ...wsOpts,
    enabled: wsOpts.enabled ?? true,
    onData: (data, action) => {
      if (onData) {
        onData({
          action,
          data,
          allData: queryResult.data as unknown as TData[],
          append: queryResult.append as any,
          prepend: queryResult.prepend as any,
          update: queryResult.update as any,
          insert: queryResult.insert as any,
        });
      } else {
        queryResult.append(data as any);
      }
    },
  });

  // 3. Handle window focus / network restore — pass infinite query data, not raw WS data
  const onWindowFocusRef = useRef(onWindowFocus);
  onWindowFocusRef.current = onWindowFocus;
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;
  const queryDataRef = useRef(queryResult.data);
  queryDataRef.current = queryResult.data;
  const queryPagesRef = useRef(queryResult.pages);
  queryPagesRef.current = queryResult.pages;
  const queryPageParamsRef = useRef(queryResult.pageParams);
  queryPageParamsRef.current = queryResult.pageParams;

  useEffect(() => {
    const buildContext = () => ({
      data: queryDataRef.current as unknown as TData[],
      pages: queryPagesRef.current,
      pageParams: queryPageParamsRef.current,
      refetch: queryResult.refetch,
      reset: queryResult.reset,
      prepend: queryResult.prepend as (item: TData | TData[]) => () => void,
      append: queryResult.append as (item: TData | TData[]) => () => void,
      insert: queryResult.insert as (
        index: number,
        item: TData | TData[],
      ) => () => void,
      update: queryResult.update as (
        arg: number | ((item: TData) => boolean),
        updater: TData | ((item: TData) => TData),
      ) => () => void,
      remove: queryResult.remove as (
        arg: number | ((item: TData) => boolean),
      ) => () => void,
      setPages: queryResult.setPages as (
        updater: (
          oldPages: typeof queryResult.pages,
        ) => typeof queryResult.pages,
      ) => () => void,
      snapshot: queryResult.snapshot,
    });

    const onFocus = () => onWindowFocusRef.current?.(buildContext());
    const onOnline = () => onReconnectRef.current?.(buildContext());

    // Always register — ref guards handle undefined callbacks,
    // so late-provided callbacks work without re-subscribing.
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const arrangedData = useMemo(() => {
    if (arrange) {
      return arrange(queryResult.data as unknown as TData[]);
    }
    return queryResult.data;
  }, [queryResult.data, arrange]);

  return {
    ...queryResult,
    data: arrangedData,
    send: wsResult.send,
    unsubscribe: wsResult.unsubscribe,
    status: wsResult.status,
    error: wsResult.error,
    queryError: queryResult.error,
  };
}
