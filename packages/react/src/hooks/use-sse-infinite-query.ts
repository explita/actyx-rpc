import { useEffect, useMemo, useRef } from "react";
import { useInfiniteQuery } from "./use-infinite-query.js";
import type {
  ExtractInfiniteItem,
  ExtractInfinitePage,
  SSEAdapterOptions,
} from "../types/main.js";
import { useSSE } from "./use-sse.js";

export function useSSEInfiniteQuery<
  TProc extends (...args: any[]) => Promise<any>,
  TFullPage = ExtractInfinitePage<TProc>,
  TPage = ExtractInfiniteItem<TFullPage>,
  TInput = Parameters<TProc>[0],
  TQueryKey extends unknown[] = unknown[],
  TData = TPage,
>(
  queryProcedure: TProc,
  {
    queryOpts,
    onData,
    arrange,
    ...sseOpts
  }: SSEAdapterOptions<TInput, TData, TPage, TQueryKey, TFullPage>,
) {

  const optsRef = useRef({ onData, arrange });
  useEffect(() => {
    optsRef.current = { arrange, onData };
  });
  // 1. Instantiate the paginated query
  const queryResult = useInfiniteQuery(queryProcedure, queryOpts);

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
