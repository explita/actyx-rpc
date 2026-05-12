import type { ErrorResponse } from "../types/misc.js";

export type MutationStatus = "idle" | "pending" | "success" | "error";

export type UseMutationOpts<
  TOutput,
  TArgs extends any[] = any[],
  TContext = unknown,
> = {
  /**
   * Callback function to be executed when the procedure is successful.
   * @param data The data returned by the procedure.
   */
  onSuccess?: (data: TOutput, ...args: TArgs) => void;
  /**
   * Callback function to be executed when the procedure fails.
   * @param error The error message.
   */
  onError?: (error: string, ...args: TArgs) => void;
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
  onSettled?: (data?: TOutput, error?: string, ...args: TArgs) => void;
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

export type UseInfiniteQueryOpts<TInput, TPage> = {
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
};

export type UseInfiniteQueryReturn<TPage, TContext> = {
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
  context: TContext | undefined;
};

export type UseQueryOpts<TOutput, TUnwrap extends boolean = false> = {
  enabled?: boolean;
  initialData?: Omit<Unwrap<TOutput, TUnwrap>, "success">;
  onSuccess?: (data: TOutput) => void;
  onError?: (error: ErrorResponse) => void;
  onSettled?: (data: TOutput | null, error: ErrorResponse | null) => void;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  /**
   * Automatically unwrap the 'data' field from standard RPC success responses.
   * @default false
   */
  unwrap?: TUnwrap;
  /**
   * Unique key for this query. If provided, simultaneous requests for the same key will be deduplicated.
   */
  queryKey?: QueryKey[] | readonly QueryKey[];
};

type QueryKey = number | string;

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
> = {
  data: TInitialData extends undefined
    ? Unwrap<TOutput, TUnwrap> | undefined
    : Unwrap<TOutput, TUnwrap>;
  error: ErrorResponse | undefined;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: TInitialData extends undefined
    ? () => Promise<Unwrap<TOutput, TUnwrap> | undefined>
    : () => Promise<Unwrap<TOutput, TUnwrap>>;
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
