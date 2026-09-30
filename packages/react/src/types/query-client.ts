import type { ErrorResponse, WindowTime } from "./main.js";
import type { QueryResult as ProcQueryResult } from "./misc.js";

/**
 * Default options applied to all queries created by a `QueryClient`.
 *
 * These values serve as fallback defaults when individual `useQuery` / `useInfiniteQuery`
 * calls don't specify their own options.
 */
export type DefaultQueryOptions = {
  /** Whether queries are enabled by default. */
  enabled?: boolean;
  /**
   * Time before data is considered stale.
   * @default 0
   */
  staleTime?: WindowTime;
  /**
   * Time before inactive cache entries are garbage collected.
   * @default 300000 (5 minutes)
   */
  gcTime?: WindowTime;
  /**
   * Whether to refetch when the window regains focus.
   * @default false
   */
  refetchOnWindowFocus?: boolean;
  /**
   * Whether to refetch on mount if data is stale.
   * - `true`: Refetch if stale.
   * - `"always"`: Always refetch unconditionally.
   * @default true
   */
  refetchOnMount?: boolean | "always";
  /**
   * Whether to refetch when the network reconnects.
   * @default true
   */
  refetchOnReconnect?: boolean;
  /** Interval in milliseconds for automatic background refetching. */
  refetchInterval?: number;
  /**
   * Whether to keep previous data while refetching.
   * @default true
   */
  keepPreviousData?: boolean;
  /** Default error callback for all queries. */
  onError?: (err: ErrorResponse) => void;
  /** Default success callback for all queries. */
  onSuccess?: (data: any) => void;
  /** Default settled callback for all queries. */
  onSettled?: (data: any, error: ErrorResponse | null) => void;
};

/**
 * Default options applied to all mutations created by a `QueryClient`.
 *
 * These values serve as fallback defaults when individual `useMutation`
 * calls don't specify their own options.
 */
export type DefaultMutationOptions = {
  /** Default debounce time for mutations. */
  debounce?: number | WindowTime;
  /** Whether mutations should throw on error by default. */
  throwOnError?: boolean;
  /** Default error callback for all mutations. */
  onError?: (err: ErrorResponse, context?: unknown, ...args: any[]) => void;
  /** Default success callback for all mutations. */
  onSuccess?: (data: any, context?: unknown, ...args: any[]) => void;
  /** Default settled callback for all mutations. */
  onSettled?: (
    data: any,
    error: ErrorResponse | null,
    context?: unknown,
    ...args: any[]
  ) => void;
  /** Default `onMutate` callback for all mutations. */
  onMutate?: (...args: any[]) => unknown;
};

/**
 * Configuration for a `QueryClient` instance.
 *
 * Sets global defaults for all queries and mutations managed by this client,
 * and controls the maximum number of entries in the query cache.
 */
export interface QueryClientConfig {
  /** Default options applied to all queries. */
  queries?: DefaultQueryOptions;
  /** Default options applied to all mutations. */
  mutations?: DefaultMutationOptions;
  /**
   * Maximum number of entries to keep in the query cache.
   * Oldest entries are evicted when this limit is exceeded.
   */
  maxCacheSize?: number;
}

/** Alias for `QueryClientConfig`. */
export type DefaultOptions = QueryClientConfig;

/**
 * Internal cache state for a single query entry.
 *
 * Tracks the current data, error, fetch status, and staleness timestamp.
 *
 * @template TData - The cached data type.
 * @template TError - The error type (defaults to `any`).
 */
export type QueryState<TData = any, TError = any> = {
  /** The cached data, or `undefined` if not yet fetched. */
  data: TData | undefined;
  /** The error from the last failed fetch, or `undefined`. */
  error: TError | undefined;
  /** Whether a fetch is currently in progress. */
  isFetching: boolean;
  /** Whether the last fetch resulted in an error. */
  isError: boolean;
  /** Whether the last fetch was successful. */
  isSuccess: boolean;
  /** Timestamp (ms) of the last successful data update. */
  updatedAt: number;
  /** Whether the query has completed at least one fetch. */
  isFetched: boolean;
};

/**
 * A log entry for a single mutation execution tracked by the `QueryClient`.
 *
 * Used by devtools and `useIsMutating` for observing mutation lifecycle.
 */
export type MutationLogEntry = {
  /** Unique identifier for this mutation execution. */
  id: string;
  /** Serialized mutation key string. */
  mutationKey: string;
  /** Current lifecycle status. */
  status: "pending" | "success" | "error";
  /** Timestamp (ms) when the mutation started. */
  startedAt: number;
  /** Timestamp (ms) when the mutation completed (success or error). */
  endedAt?: number;
  /** Duration of the mutation in milliseconds. */
  durationMs?: number;
  /** The variables/arguments passed to `mutate`. */
  variables?: any;
  /** The data returned on success. */
  data?: any;
  /** The error on failure. */
  error?: any;
};

/**
 * Snapshot of a single query cache entry exposed by `QueryClient.getQueries()`.
 *
 * Used by devtools for inspecting cache state.
 */
export type QueryCacheEntry = {
  /** Serialized query key string. */
  queryKey: string;
  /** Current internal query state. */
  state: QueryState;
  /** Whether the cached data is stale and should be refetched on next use. */
  isStale: boolean;
  /** Number of active hook listeners subscribed to this cache entry. */
  listenersCount: number;
  /** Configured stale time in milliseconds. */
  staleTimeMs: number;
};

/**
 * A dehydrated query snapshot for SSR hydration.
 *
 * Contains the minimum data needed to rehydrate the query cache on the client.
 */
export type DehydratedQuery = {
  /** Serialized query key string. */
  queryKey: string;
  /** The cached data to rehydrate. */
  data: any;
  /** Timestamp (ms) when the data was last updated on the server. */
  updatedAt: number;
};

/**
 * A dehydrated mutation snapshot for SSR hydration.
 *
 * Contains the minimum data needed to rehydrate pending mutations on the client.
 */
export type DehydratedMutation = {
  /** Unique mutation identifier. */
  id?: string;
  /** Serialized mutation key string. */
  mutationKey: string;
  /** Mutation lifecycle status at time of dehydration. */
  status: "pending" | "success" | "error";
  /** Timestamp (ms) when the mutation started. */
  startedAt: number;
  /** Duration of the mutation in milliseconds. */
  durationMs?: number;
  /** The variables/arguments passed to `mutate`. */
  variables?: any;
  /** The data returned on success. */
  data?: any;
};

/**
 * Full dehydrated state snapshot for SSR hydration.
 *
 * Produced by `queryClient.dehydrate()` and consumed by `HydrationBoundary`
 * or `queryClient.hydrate()` on the client.
 */
export type DehydratedState = {
  /** Dehydrated query cache entries. */
  queries: DehydratedQuery[];
  /** Dehydrated mutation log entries (optional). */
  mutations?: DehydratedMutation[];
};

/**
 * Options controlling which queries and mutations are included during dehydration.
 */
export type DehydrateOptions = {
  /** Predicate to filter which queries to include in the dehydrated state. */
  shouldDehydrateQuery?: (query: QueryCacheEntry) => boolean;
  /** Predicate to filter which mutations to include in the dehydrated state. */
  shouldDehydrateMutation?: (mutation: MutationLogEntry) => boolean;
};

/**
 * Options for rehydrating a dehydrated state snapshot on the client.
 */
export type HydrateOptions = {
  /** Default options applied to rehydrated queries. */
  defaultOptions?: {
    queries?: {
      /**
       * Stale time for rehydrated queries.
       * Set to `Infinity` to prevent immediate refetch after hydration.
       */
      staleTime?: WindowTime;
    };
  };
};

/**
 * Options for imperatively prefetching a query outside of a React component.
 *
 * Used with `queryClient.prefetchQuery()` for SSR or route-level prefetching.
 *
 * @template TOutput - The expected query data type.
 * @template TError - The expected error type.
 */
export type PrefetchQueryOptions<TOutput = any, TError = any> = {
  /**
   * The query key — a string, an array, or an object with a `getQueryKey` method.
   */
  queryKey: string | unknown[] | { getQueryKey: (...args: any[]) => unknown[] };
  /** The async function that fetches the query data. */
  queryFn:
    | (() => Promise<ProcQueryResult<TOutput>>)
    | (() => Promise<[TOutput, null] | [null, TError]>)
    | (() => Promise<TOutput>)
    | (() => Promise<any>);
  /**
   * Time before the prefetched data is considered stale.
   * Set to `Infinity` to keep it fresh until explicitly invalidated.
   */
  staleTime?: WindowTime;
  /** Whether to automatically unwrap the `{ data }` envelope. */
  unwrap?: boolean;
};
