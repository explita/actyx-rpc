import type { ErrorResponse } from "../types/misc.js";

export type MutationStatus = "idle" | "pending" | "success" | "error";

export type UseMutationOpts<
  TOutput,
  TArgs extends any[] = any[],
  TContext = unknown,
  TMutationKey extends unknown[] = unknown[],
> = {
  /**
   * Callback function to be executed when the procedure is successful.
   * @param data The data returned by the procedure.
   */
  onSuccess?: (
    data: TOutput,
    context: TContext | undefined,
    ...args: TArgs
  ) => void;
  /**
   * Callback function to be executed when the procedure fails.
   * @param error The error message.
   */
  onError?: (
    error: ErrorResponse,
    context: TContext | undefined,
    ...args: TArgs
  ) => void;
  /**
   * Callback function to be executed when the procedure fails due to validation errors.
   * @param errors The validation errors.
   */
  onValidationErrors?: (
    errors: Partial<Record<keyof TArgs[0], string>>,
  ) => void;
  /**
   * Callback function to be executed when the procedure progress changes.
   * @param progress The progress percentage (0-100).
   */
  onProgress?: (progress: number) => void;
  /**
   * Callback function to be executed when the procedure is settled.
   */
  onSettled?: (
    data: TOutput | undefined,
    error: ErrorResponse | undefined,
    context: TContext | undefined,
    ...args: TArgs
  ) => void;
  /**
   * Callback function to be executed before the procedure is mutated.
   * @param args The arguments for the procedure.
   * @returns The context for the procedure.
   */
  onMutate?: (...args: TArgs) => Promise<TContext> | TContext;

  /**
   * Optimistic update function.
   * @param args The arguments for the procedure.
   * @returns The optimistic update for the procedure.
   */
  optimisticUpdate?: (
    ...args: TArgs
  ) =>
    | Omit<TOutput, "message" | "success">
    | Promise<Omit<TOutput, "message" | "success">>
    | TOutput;
  /**
   * Debounce time in milliseconds.
   */
  debounceMs?: number;
  /**
   * Whether to throw an error when the procedure fails.
   */
  throwOnError?: boolean;
  /**
   * Optional key to identify the mutation, allowing `useIsMutating` to filter by this key.
   */
  mutationKey?: TMutationKey;
};

export type WithoutCursor<TInput> = TInput extends { cursor?: any }
  ? never
  : TInput;

export type InfiniteQueryPage<TData> = {
  data: TData[];
  nextCursor?: string | number | null;
  previousCursor?: string | number;
  hasMore: boolean;
};

export type UseInfiniteQueryOpts<
  TInput,
  TPage,
  TQueryKey extends unknown[] = unknown[],
> = {
  initialInput: WithoutCursor<TInput>;
  enabled?: boolean;
  initialPageParam?: string | number;
  initialData?: {
    pages: InfiniteQueryPage<TPage>[];
    pageParams: (string | number)[];
  };
  getNextPageParam?: (
    lastPage: InfiniteQueryPage<TPage>,
  ) => string | number | null | undefined;
  maxPages?: number;
  refetchOnWindowFocus?: boolean;
  refetchInterval?: number;
  cacheSize?: number; // Maximum number of pages to cache
  onSuccess?: (data: {
    pages: InfiniteQueryPage<TPage>[];
    pageParams: (string | number)[];
  }) => void;
  onError?: (error: ErrorResponse) => void;
  onSettled?: () => void;
  queryKey?: TQueryKey;
  staleTime?: number;
  gcTime?: number;
  /**
   * Refetch on network reconnect
   * @default true
   */
  refetchOnReconnect?: boolean | "always";
};

export type UseInfiniteQueryReturn<TPage> = {
  data: TPage[]; // Flattened data for convenience
  pages: InfiniteQueryPage<TPage>[];
  pageParams: (string | number)[];
  fetchNext: () => Promise<InfiniteQueryPage<TPage> | undefined>;
  fetchPrevious: () => Promise<InfiniteQueryPage<TPage> | undefined>;
  hasNext: boolean;
  hasPrevious: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  error: ErrorResponse | undefined;
  refetch: () => Promise<void>;
  reset: () => void;
};

export type UseQueryOpts<
  TOutput,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
> = {
  enabled?: boolean;
  initialData?: Omit<TSelectData, "success">;
  onSuccess?: (data: TSelectData) => void;
  onError?: (error: ErrorResponse) => void;
  onSettled?: (data: TSelectData | null, error: ErrorResponse | null) => void;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  /**
   * Refetch on network reconnect
   * @default true
   */
  refetchOnReconnect?: boolean | "always";
  /**
   * The time in milliseconds after data is considered stale. If set to Infinity, the data will never be considered stale.
   * @default 0
   */
  staleTime?: number;
  /**
   * If true, refetches on mount if the data is stale. If "always", refetches on mount unconditionally. If false, disables refetch on mount.
   * @default true
   */
  refetchOnMount?: boolean | "always";
  /**
   * The time in milliseconds that unused/inactive cache data remains in memory.
   * @default 300000 (5 minutes)
   */
  gcTime?: number;
  /**
   * Automatically unwrap the 'data' field from standard RPC success responses.
   * @default false
   */
  unwrap?: TUnwrap;
  /**
   * Unique key for this query. If provided, simultaneous requests for the same key will be deduplicated.
   */
  queryKey?: TQueryKey;
  /**
   * Transform the data before it is returned to the component.
   */
  select?: (data: Unwrap<TOutput, TUnwrap>) => TSelectData;
};

/**
 * Automatically unwrap the 'data' field from standard RPC success responses.
 */
export type Unwrap<T, DoUnwrap extends boolean = false> = DoUnwrap extends true
  ? T extends { data: infer D }
    ? D
    : T
  : T;

// Conditional return type based on initialData presence
export type QueryResult<
  TOutput,
  TInitialData,
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
> = {
  data: TInitialData extends undefined
    ? TSelectData | undefined
    : TSelectData;
  error: ErrorResponse | undefined;
  isFetching: boolean;
  isRefetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: TInitialData extends undefined
    ? () => Promise<TSelectData | undefined>
    : () => Promise<TSelectData>;
  reset: () => void;
};

export type UseSubscriptionOpts<TOutput> = {
  wsUrl: string;
  enabled?: boolean;
  onData?: (data: TOutput) => void;
  onError?: (error: ErrorResponse) => void;
  onSubscribed?: () => void;
  onUnsubscribed?: () => void;
};

export type UseSubscriptionReturn<TOutput> = {
  data: TOutput | undefined;
  status: "idle" | "connecting" | "connected" | "error";
  error: ErrorResponse | undefined;
  unsubscribe: () => void;
};

export type UseQueriesQueryConfig<
  TOutput = any,
  TInitialData = undefined,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
> = {
  proc: () => Promise<[TOutput, null] | [null, ErrorResponse]>;
  queryKey: TQueryKey;
} & Omit<UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData>, "queryKey"> & {
  initialData?: TInitialData;
};

export type QueriesResults<T extends readonly any[]> = {
  [K in keyof T]: T[K] extends UseQueriesQueryConfig<infer TOut, infer TInit, any, infer TUnwrap, infer TSelect>
    ? QueryResult<TOut, TInit, TUnwrap, TSelect>
    : T[K] extends { proc: () => Promise<[infer TOut, null] | [null, ErrorResponse]> }
      ? QueryResult<TOut, undefined, false, TOut>
      : never;
};

export type UseSSEOptions<T = any> = {
  url: string;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  enabled?: boolean;
  maxHistory?: number;
  onData?: (data: T, event: string | undefined) => void;
  onError?: (error: ErrorResponse) => void;
};

export type UseSSEReturn<T = any> = {
  data: T[];
  lastData: T | undefined;
  event: string | undefined;
  isConnected: boolean;
  error: ErrorResponse | undefined;
  close: () => void;
  clear: () => void;
};


