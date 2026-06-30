import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "./use-infinite-query.js";
import { useWS } from "./use-ws.js";
import type { InfiniteQueryPage, WSAdapterOptions } from "../types.js";
import type { QueryResult } from "../../types/misc.js";

export function useWSInfiniteQuery<
  TFullPage extends InfiniteQueryPage<any> = InfiniteQueryPage<any>,
  TInput = any,
  TPage = TFullPage extends InfiniteQueryPage<infer P> ? P : never,
  TQueryKey extends unknown[] = unknown[],
  TData = TPage,
>(
  queryProcedure: (input: TInput) => Promise<QueryResult<TFullPage>>,
  {
    queryOpts,
    onData,
    arrange,
    onWindowFocus,
    onReconnect,
    ...wsOpts
  }: WSAdapterOptions<TInput, TData, TPage, TQueryKey, TFullPage>,
) {
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

  useEffect(() => {
    const onFocus = () =>
      onWindowFocusRef.current?.({
        data: queryDataRef.current as unknown as TData[],
        refetch: queryResult.refetch,
      });
    const onOnline = () =>
      onReconnectRef.current?.({
        data: queryDataRef.current as unknown as TData[],
        refetch: queryResult.refetch,
      });

    if (onWindowFocusRef.current) window.addEventListener("focus", onFocus);
    if (onReconnectRef.current) window.addEventListener("online", onOnline);

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
    error: wsResult.error || queryResult.error,
  };
}
