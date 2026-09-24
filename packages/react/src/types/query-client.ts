import type { ErrorResponse, WindowTime } from "./main.js";
import type { QueryResult as ProcQueryResult } from "./misc.js";

export type DefaultQueryOptions = {
  enabled?: boolean;
  staleTime?: WindowTime;
  gcTime?: WindowTime;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean | "always";
  refetchOnReconnect?: boolean;
  refetchInterval?: number;
  keepPreviousData?: boolean;
  onError?: (err: ErrorResponse) => void;
  onSuccess?: (data: any) => void;
  onSettled?: (data: any, error: ErrorResponse | null) => void;
};

export type DefaultMutationOptions = {
  debounce?: number | WindowTime;
  throwOnError?: boolean;
  onError?: (err: ErrorResponse, context?: unknown, ...args: any[]) => void;
  onSuccess?: (data: any, context?: unknown, ...args: any[]) => void;
  onSettled?: (
    data: any,
    error: ErrorResponse | null,
    context?: unknown,
    ...args: any[]
  ) => void;
  onMutate?: (...args: any[]) => unknown;
};

export interface QueryClientConfig {
  queries?: DefaultQueryOptions;
  mutations?: DefaultMutationOptions;
  maxCacheSize?: number;
}

export type DefaultOptions = QueryClientConfig;

export type QueryState<TData = any, TError = any> = {
  data: TData | undefined;
  error: TError | undefined;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  updatedAt: number;
  isFetched: boolean;
};

export type MutationLogEntry = {
  id: string;
  mutationKey: string;
  status: "pending" | "success" | "error";
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  variables?: any;
  data?: any;
  error?: any;
};

export type QueryCacheEntry = {
  queryKey: string;
  state: QueryState;
  isStale: boolean;
  listenersCount: number;
  staleTimeMs: number;
};

export type DehydratedQuery = {
  queryKey: string;
  data: any;
  updatedAt: number;
};

export type DehydratedMutation = {
  id?: string;
  mutationKey: string;
  status: "pending" | "success" | "error";
  startedAt: number;
  durationMs?: number;
  variables?: any;
  data?: any;
};

export type DehydratedState = {
  queries: DehydratedQuery[];
  mutations?: DehydratedMutation[];
};

export type DehydrateOptions = {
  shouldDehydrateQuery?: (query: QueryCacheEntry) => boolean;
  shouldDehydrateMutation?: (mutation: MutationLogEntry) => boolean;
};

export type HydrateOptions = {
  defaultOptions?: {
    queries?: {
      staleTime?: WindowTime;
    };
  };
};

export type PrefetchQueryOptions<TOutput = any, TError = any> = {
  queryKey:
    | string
    | unknown[]
    | { getQueryKey: (...args: any[]) => unknown[] };
  queryFn:
    | (() => Promise<ProcQueryResult<TOutput>>)
    | (() => Promise<[TOutput, null] | [null, TError]>)
    | (() => Promise<TOutput>)
    | (() => Promise<any>);
  staleTime?: WindowTime;
};


