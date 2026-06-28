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
  const result = useQuery<TOutput, TQueryKey, TUnwrap, undefined, TSelectData>(
    proc,
    { ...opts, enabled: true, initialData: undefined },
  );

  if (result.isError && result.error) {
    throw result.error;
  }

  if (result.data === undefined) {
    const queryKeyStr = opts?.queryKey
      ? opts.queryKey
          .map((i) =>
            typeof i === "object" && i !== null ? JSON.stringify(i) : String(i),
          )
          .join("|")
      : "";
    const activePromise = globalRequestManager.getActivePromise(queryKeyStr);

    if (activePromise) {
      throw activePromise;
    } else {
      throw result.refetch();
    }
  }

  return result as UseSuspenseQueryResult<TOutput, TUnwrap, TSelectData>;
}
