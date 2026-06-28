import { useMemo } from "react";
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
    ...wsOpts
  }: WSAdapterOptions<TInput, TData, TPage, TQueryKey, TFullPage>,
) {
  // 1. Instantiate the paginated query
  const queryResult = useInfiniteQuery(queryProcedure, queryOpts);

  // 2. Attach WebSocket listener spreading all wsOpts
  const wsResult = useWS<TData, TData>({
    ...wsOpts,
    enabled: wsOpts.enabled ?? true,
    onData: (data) => {
      if (onData) {
        onData({
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
