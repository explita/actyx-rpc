import type { ErrorResponse } from "../types/misc.js";

export type MutationStatus = "idle" | "pending" | "success" | "error";

export type UseMutationOpts<TOutput, TInput = any, TContext = unknown> = {
  /**
   * Callback function to be executed when the procedure is successful.
   * @param data The data returned by the procedure.
   */
  onSuccess?: (data: TOutput, input: TInput, context?: TContext) => void;
  /**
   * Callback function to be executed when the procedure fails.
   * @param error The error message.
   */
  onError?: (error: string, input: TInput, context?: TContext) => void;
  /**
   * Callback function to be executed when the procedure fails due to validation errors.
   * @param errors The validation errors.
   */
  onValidationErrors?: (errors: Partial<Record<keyof TInput, string>>) => void;
  /**
   * Callback function to be executed when the procedure is settled.
   */
  onSettled?: (
    data?: TOutput,
    error?: string,
    input?: TInput,
    context?: TContext,
  ) => void;
  /**
   * Callback function to be executed before the procedure is mutated.
   * @param input The input for the procedure.
   * @returns The context for the procedure.
   */
  onMutate?: (input: TInput) => Promise<TContext> | TContext;

  /**
   * Optimistic update function.
   * @param input The input for the procedure.
   * @returns The optimistic update for the procedure.
   */
  optimisticUpdate?: (
    input: TInput,
  ) => (
    | Omit<TOutput, "message" | "success">
    | Promise<Omit<TOutput, "message" | "success">>
  ) & { message?: string; success?: boolean };
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
