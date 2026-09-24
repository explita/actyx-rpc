"use client";

import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "./use-infinite-query.js";
import { useWS } from "./use-ws.js";
import type {
  ExtractInfiniteItem,
  ExtractInfinitePage,
  WSAdapterOptions,
} from "../types/main.js";

export function useWSInfiniteQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TFullPage = ExtractInfinitePage<TProc>,
  TPage = ExtractInfiniteItem<TFullPage>,
  TInput = Parameters<TProc>[0],
  TQueryKey extends unknown[] = unknown[],
  TData = TPage,
  TArgs extends unknown[] = Parameters<TProc> extends [any, ...infer Rest]
    ? Rest
    : [],
>(
  queryProcedure: TProc,
  {
    queryOpts,
    onData,
    arrange,
    onWindowFocus,
    onReconnect,
    ...wsOpts
  }: WSAdapterOptions<TInput, TData, TPage, TQueryKey, TFullPage, TArgs>,
) {

  const optsRef = useRef({ onData, arrange });
  useEffect(() => {
    optsRef.current = { arrange, onData };
  });

  // 1. Instantiate the paginated query
  const queryResult = useInfiniteQuery(queryProcedure, queryOpts);

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
