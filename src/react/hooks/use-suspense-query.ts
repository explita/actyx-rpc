import { useQuery } from "./use-query.js";
import { UseQueryOpts, QueryResult, Unwrap } from "../types.js";
import { ErrorResponse } from "../../types/misc.js";
import { globalRequestManager } from "../lib/request-manager.js";

type UseSuspenseQueryReturn<
  TOutput,
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
> = Omit<
  QueryResult<TOutput, undefined, TUnwrap, TSelectData>,
  "data" | "isFetching" | "isError" | "isSuccess"
> & {
  data: TSelectData;
  isFetching: false;
  isError: false;
  isSuccess: true;
};

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
): UseSuspenseQueryReturn<TOutput, TUnwrap, TSelectData> {
  const result = useQuery<TOutput, undefined, TQueryKey, TUnwrap, TSelectData>(
    proc,
    { ...opts, enabled: true, initialData: undefined },
  );

  if (result.isError && result.error) {
    throw result.error;
  }

  if (result.data === undefined) {
    const queryKeyStr = opts?.queryKey
      ? opts.queryKey.map(String).join("|")
      : "";
    const activePromise = globalRequestManager.getActivePromise(queryKeyStr);

    if (activePromise) {
      throw activePromise;
    } else {
      throw result.refetch();
    }
  }

  return result as UseSuspenseQueryReturn<TOutput, TUnwrap, TSelectData>;
}
