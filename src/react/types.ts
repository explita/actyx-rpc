import type {
  ErrorResponse,
  MaybePromise,
  Prettify,
  WindowTime,
} from "../types/misc.js";

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
   * If it throws an error or returns any non-void/non-undefined value, execution halts and is passed as the error to onError.
   */
  onBefore?: (...args: TArgs) => Promise<any> | any;
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

export type WithoutCursor<TInput> = Omit<TInput, "cursor">;

export type InfiniteQueryPage<TData> = Omit<
  {
    data: TData[];
    nextCursor?: string | number | null;
    previousCursor?: string | number;
    hasMore: boolean;
  },
  "success"
>;

/**
 * Configuration options for infinite query hooks
 * @template TInput - The input type for the query function (excluding cursor/page params)
 * @template TPage - The type of data contained in each individual page
 * @template TQueryKey - The type of the query key array for cache identification (defaults to unknown[])
 */
export type UseInfiniteQueryOpts<
  TInput,
  TPage,
  TQueryKey extends unknown[] = unknown[],
  TFullPage = InfiniteQueryPage<TPage>,
> = {
  /**
   * Initial input parameters for the query (excluding cursor/page parameters)
   * Used as the base parameters for the first page fetch
   */
  initialInput?: WithoutCursor<TInput>;

  /**
   * Whether the query should be enabled and automatically fetch
   * @default true
   */
  enabled?: boolean;

  /**
   * Initial page parameter/cursor for the first page fetch
   * Used when no cached data exists
   */
  initialPageParam?: string | number;

  /**
   * Initial data to populate the cache on mount
   * Useful for SSR or pre-filled state
   */
  initialData?:
    | {
        pages: InfiniteQueryPage<TPage>[];
        pageParams: (string | number)[];
      }
    | (() => {
        pages: InfiniteQueryPage<TPage>[];
        pageParams: (string | number)[];
      });

  /**
   * Function to extract the next page parameter from the last page
   * @param lastPage - The most recently fetched page
   * @returns Next page cursor/parameter, or null/undefined if no more pages
   */
  getNextPageParam?: (
    lastPage: TFullPage,
    allPages: TFullPage[],
  ) => string | number | null | undefined;

  /**
   * Maximum number of pages to keep in the cache
   * Older pages beyond this limit will be discarded
   * @example Setting to 5 keeps only the 5 most recent pages
   */
  maxPages?: number;

  /**
   * Whether to automatically refetch data when the window regains focus
   * @default false
   */
  refetchOnWindowFocus?: boolean;

  /**
   * Interval in milliseconds for automatic background refetching
   * @example 5000 refetches every 5 seconds
   */
  refetchInterval?: number;

  /**
   * Maximum number of pages to store in the cache
   * Controls memory usage for large paginated datasets
   */
  cacheSize?: number;

  /**
   * Callback triggered when the query successfully fetches data
   * @param data - Object containing all pages and their parameters
   */
  onSuccess?: (data: {
    pages: TFullPage[];
    pageParams: (string | number)[];
  }) => void;

  /**
   * Callback triggered when the query encounters an error
   * @param error - The error response object
   */
  onError?: (error: ErrorResponse) => void;

  /**
   * Callback triggered when the query completes (success or error)
   * Runs after onSuccess or onError
   */
  onSettled?: () => void;

  /**
   * Optional callback to arrange the flattened data.
   * @param data - The flattened data array.
   * @returns The arranged flattened data array.
   */
  arrange?: (data: TPage[]) => TPage[];

  /**
   * Unique key for identifying this query in the cache
   * Used for manual invalidation and refetching
   */
  queryKey?: TQueryKey;

  /**
   * Time in milliseconds before data is considered stale
   * Stale data will be refetched on next usage
   * @default 0 (always stale)
   */
  staleTime?: WindowTime;

  /**
   * Time in milliseconds before inactive cache data is garbage collected
   * @default 5 * 60 * 1000 (5 minutes)
   */
  gcTime?: WindowTime;

  /**
   * Whether to refetch when the network reconnects
   * - `true`: Refetch if data is stale
   * - `"always"`: Always refetch regardless of staleness
   * @default true
   */
  refetchOnReconnect?: boolean | "always";
};

/**
 * Return type for infinite query hooks that handle paginated data fetching
 * @template TPage - The type of data contained in each individual page
 */
export type InfiniteQueryResult<TPage, TFullPage = InfiniteQueryPage<TPage>> = {
  /**
   * Flattened data from all pages for convenient access
   * @example
   * // If pages contain [{items: [1,2]}, {items: [3,4]}]
   * // data would be [1,2,3,4]
   */
  data: TPage[];

  /** Array of all fetched pages with their original structure */
  pages: TFullPage[];

  /** Parameters used for each page fetch (cursors/offsets) */
  pageParams: (string | number)[];

  /**
   * Fetches the next page of data
   * @returns Promise resolving to the next page or undefined if no more pages
   */
  fetchNext: () => Promise<TFullPage | undefined>;

  /**
   * Fetches the previous page of data
   * @returns Promise resolving to the previous page or undefined if no more pages
   */
  fetchPrevious: () => Promise<TFullPage | undefined>;

  /** Whether there are more pages available to fetch forward */
  hasNext: boolean;

  /** Whether there are more pages available to fetch backward */
  hasPrevious: boolean;

  /** Whether a fetch operation is currently in progress */
  isFetching: boolean;

  /** Whether a refetch operation is currently in progress */
  isRefetching: boolean;

  /** Whether the last query operation resulted in an error */
  isError: boolean;

  /** Whether the last query operation was successful */
  isSuccess: boolean;

  /** Error object if the last operation failed, undefined otherwise */
  error: ErrorResponse | undefined;

  /** Whether the query has fetched at least once from the network */
  isFetched: boolean;

  /** Whether the query has fetched and the data is empty */
  isEmpty: boolean;

  /**
   * Manually refetches the current page data
   *
   * @returns Promise that resolves when refetch is complete
   */
  refetch: () => Promise<void>;

  /**
   * Resets the query state to its initial values
   *
   * Clears all fetched data and page parameters
   */
  reset: () => void;

  /**
   * Manually removes an item from the cached pages.
   *
   * Supports passing either the item's index in the flattened `data` array or a predicate function.
   *
   * Returns a rollback function to revert this update.
   */
  remove: (arg: number | ((item: TPage) => boolean)) => () => void;

  /**
   * Manually updates an item in the cached pages.
   *
   * Supports passing either the item's index in the flattened `data` array or a predicate function to locate the item,
   * along with an updater function or a new item object.
   *
   * Returns a rollback function to revert this update.
   */
  update: (
    arg: number | ((item: TPage) => boolean),
    updater: TPage | ((item: TPage) => TPage),
  ) => () => void;

  /**
   * Manually prepends an item to the first page.
   *
   * Returns a rollback function to revert this update.
   */
  prepend: (item: TPage) => () => void;

  /**
   * Manually appends an item to the last page.
   *
   * Returns a rollback function to revert this update.
   */
  append: (item: TPage) => () => void;

  /**
   * Manually inserts an item at a specific flattened index.
   *
   * Returns a rollback function to revert this update.
   */
  insert: (index: number, item: TPage) => () => void;

  /**
   * Manually updates the cached pages structure using an updater function.
   *
   * Returns a rollback function to revert this update.
   */
  setPages: (updater: (oldPages: TFullPage[]) => TFullPage[]) => () => void;

  /**
   * Takes a snapshot of the current query cache state.
   *
   * Returns a rollback function to restore the cache to this snapshot state.
   */
  snapshot: () => () => void;
};

export type UseQueryOpts<
  TOutput,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
> = {
  /**
   * Whether the query is enabled and should automatically fetch data.
   * If false, the query will not run automatically.
   * @default true
   */
  enabled?: boolean;

  /**
   * Callback triggered when the query successfully fetches data.
   * @param data - The successfully fetched and selected query data.
   */
  onSuccess?: (data: TSelectData) => void;

  /**
   * Callback triggered when the query encounters an error.
   * @param error - The error response returned by the procedure.
   */
  onError?: (error: ErrorResponse) => void;

  /**
   * Callback triggered when the query completes (either successfully or with an error).
   * @param data - The fetched query data on success, otherwise null.
   * @param error - The error response on failure, otherwise null.
   */
  onSettled?: (data: TSelectData | null, error: ErrorResponse | null) => void;

  /**
   * Interval in milliseconds for automatic background refetching.
   * If set to 0 or undefined, automatic background refetching is disabled.
   */
  refetchInterval?: number;

  /**
   * Whether to automatically refetch data when the browser window regains focus.
   * @default false
   */
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
  staleTime?: WindowTime;
  /**
   * If true, refetches on mount if the data is stale. If "always", refetches on mount unconditionally. If false, disables refetch on mount.
   * @default true
   */
  refetchOnMount?: boolean | "always";
  /**
   * The time in milliseconds that unused/inactive cache data remains in memory.
   * @default 300000 (5 minutes)
   */
  gcTime?: WindowTime;
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

/**
 * The result object returned by the useQuery hook.
 *
 * @template TOutput - The raw output type returned by the procedure.
 * @template TInitialData - The type of initial data provided to the hook.
 * @template TUnwrap - Whether the response is automatically unwrapped.
 * @template TSelectData - The type of the selected data after transformation.
 */
export type QueryResult<
  TOutput,
  TInitialData,
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
> = {
  /**
   * The cached data returned by the query.
   * If `initialData` is provided, this is guaranteed to be defined (non-undefined) on mount.
   */
  data: TInitialData extends undefined ? TSelectData | undefined : TSelectData;

  /**
   * The error response object if the query failed, otherwise undefined.
   */
  error: ErrorResponse | undefined;

  /**
   * Whether a fetch operation is currently in progress (including background fetches).
   */
  isFetching: boolean;

  /**
   * Whether a refetch operation is currently in progress on an already-cached value.
   */
  isRefetching: boolean;

  /**
   * Whether the last query operation resulted in an error.
   */
  isError: boolean;

  /**
   * Whether the last query operation succeeded.
   */
  isSuccess: boolean;

  /**
   * Whether the query has fetched at least once from the network.
   */
  isFetched: boolean;

  /**
   * Whether the query has fetched and the data is empty.
   */
  isEmpty: boolean;

  /**
   * Triggers a manual refetch of the query data.
   *
   * @returns A promise resolving to the updated query data.
   */
  refetch: TInitialData extends undefined
    ? () => Promise<TSelectData | undefined>
    : () => Promise<TSelectData>;

  /**
   * Resets the query state to its initial values.
   */
  reset: () => void;
};

/**
 * Options for the usews hook.
 *
 * @template TOutput - The type of data received from the ws.
 * @template TInitialData - The type of initial data.
 */
export type UseWSOpts<TOutput> = {
  /**
   * The WebSocket server URL to connect to.
   */
  url: string;

  /**
   * Initial data to prepopulate the data array with.
   * Must be an array — the same shape as `data`.
   */
  initialData?: TOutput[] | (() => MaybePromise<TOutput[]>);

  /**
   * Whether the WebSocket ws should be active.
   * @default true
   */
  enabled?: boolean;

  /**
   * Callback triggered whenever new data is received over the ws.
   * @param data - The received data payload.
   */
  onData?: (data: TOutput) => void;

  /**
   * Callback triggered when a connection or ws error occurs.
   */
  onError?: (error: ErrorResponse) => void;

  /**
   * Callback triggered when the ws connection is successfully established.
   */
  onSubscribed?: () => void;

  /**
   * Callback triggered when the ws connection is closed.
   */
  onUnsubscribed?: () => void;

  /**
   * Optional callback to arrange the data array.
   * @param data - The data array to arrange.
   * @returns The arranged data array.
   */
  arrange?: (data: TOutput[]) => TOutput[];

  /**
   * Configuration for automatic reconnection when the connection is lost.
   */
  reconnect?: {
    /**
     * The maximum number of reconnect attempts before giving up.
     * @default 5
     */
    maxAttempts?: number;
    /**
     * The delay in milliseconds between reconnect attempts.
     * Can be a number or a function that receives the current attempt count (0-indexed).
     * @default (attempt) => Math.min(1000 * Math.pow(2, attempt), 30000)
     */
    delay?: number | ((attempt: number) => number);
  };
};

/**
 * Return shape of the usews hook.
 *
 * @template TOutput - The type of data received from the ws.
 */
export type UseWSResult<TOutput> = {
  /**
   * All data payloads received since the connection was established.
   * Accumulated in order of arrival.
   */
  data: TOutput[];

  /**
   * The current state of the ws connection.
   */
  status: "idle" | "connecting" | "connected" | "error";

  /**
   * The connection error if the status is "error", otherwise undefined.
   */
  error: ErrorResponse | undefined;

  /**
   * Cleanly closes the WebSocket ws connection.
   */
  unsubscribe: () => void;

  /**
   * Sends a message over the WebSocket connection.
   * Safe to call before the connection is established (message will be queued and sent on open).
   * @param data - The data to send. Will be JSON-stringified.
   */
  send: (data: TOutput) => void;

  /**
   * Whether the initial data is being fetched (only applies if `initialData` is a function that returns a Promise).
   */
  isFetchingInitialData: boolean;
};

export type UseQueriesConfig<
  TOutput = any,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TInitialData extends Omit<Unwrap<TOutput, TUnwrap>, "success"> | undefined =
    undefined,
  TSelectData = Unwrap<TOutput, TUnwrap>,
> = {
  proc: () => Promise<[TOutput, null] | [null, ErrorResponse]>;
  queryKey: TQueryKey;
} & Omit<UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData>, "queryKey"> & {
    initialData?: TInitialData | (() => TInitialData);
  };

export type QueriesResults<T extends readonly any[]> = {
  [K in keyof T]: T[K] extends UseQueriesConfig<
    infer TOut,
    any,
    infer TUnwrap,
    infer TInit,
    infer TSelect
  >
    ? QueryResult<TOut, TInit, TUnwrap, TSelect>
    : T[K] extends {
          proc: () => Promise<[infer TOut, null] | [null, ErrorResponse]>;
        }
      ? QueryResult<TOut, undefined, false, TOut>
      : never;
};

/**
 * Options for the useSSE hook.
 *
 * @template T - The type of data received from the SSE events.
 */
export type UseSSEOpts<T = any> = {
  /**
   * The Server-Sent Events endpoint URL to connect to.
   */
  url: string;

  /**
   * Optional query parameters to append to the SSE URL.
   */
  params?: Record<string, any>;

  /**
   * Custom request headers to send when initiating the connection.
   */
  headers?: Record<string, string>;

  /**
   * An AbortSignal to cancel the active event source connection.
   */
  signal?: AbortSignal;

  /**
   * Whether the event source connection should be active.
   * @default true
   */
  enabled?: boolean;

  /**
   * The maximum number of historical events to keep in the `data` array.
   * Older events exceeding this limit will be discarded.
   * @default 100
   */
  maxHistory?: number;

  /**
   * Callback triggered when a new event message is received.
   * @param data - The parsed event data.
   * @param event - The name of the event type, if specified.
   */
  onData?: (data: T, event: string | undefined) => void;

  /**
   * Callback triggered when a connection or event source error occurs.
   */
  onError?: (error: ErrorResponse) => void;

  /**
   * Optional callback to arrange the data array.
   * @param data - The data array to arrange.
   * @returns The arranged data array.
   */
  arrange?: (data: T[]) => T[];
};

/**
 * Return shape of the useSSE hook.
 *
 * @template T - The type of data received from the SSE events.
 */
export type UseSSEResult<T = any> = {
  /**
   * An array containing received events up to the `maxHistory` limit.
   */
  data: T[];

  /**
   * The most recently received event data payload.
   */
  lastData: T | undefined;

  /**
   * The name of the most recently received event type.
   */
  event: string | undefined;

  /**
   * Whether the event source connection is currently open and active.
   */
  isConnected: boolean;

  /**
   * The connection error if the connection failed, otherwise undefined.
   */
  error: ErrorResponse | undefined;

  /**
   * Cleanly closes the Server-Sent Events connection.
   */
  close: () => void;

  /**
   * Clears the accumulated events from the `data` and `lastData` state.
   */
  clear: () => void;
};

export type UseSuspenseQueryResult<
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

export interface WSEventContext<TData = any> {
  data: TData;
  allData: TData[];
  append: (item: TData) => void;
  prepend: (item: TData) => void;
  update: (
    predicate: number | ((item: TData) => boolean),
    updater: (item: TData) => TData,
  ) => void;
}

export interface WSAdapterOptions<
  TInput,
  TData,
  TPage,
  TQueryKey extends unknown[] = unknown[],
  TFullPage = InfiniteQueryPage<TData>,
> extends Omit<UseWSOpts<TData>, "onData"> {
  // Infinite Query options
  queryOpts?: Omit<
    UseInfiniteQueryOpts<TInput, TPage, TQueryKey, TFullPage>,
    "arrange"
  >;

  // Custom onWSData with query cache actions
  onData?: (opts: WSEventContext<TData>) => void;
}

export interface SSEAdapterOptions<
  TInput,
  TData,
  TPage,
  TQueryKey extends unknown[] = unknown[],
  TFullPage = InfiniteQueryPage<TData>,
> extends Omit<UseSSEOpts<TData>, "onData"> {
  // Infinite Query options
  queryOpts?: Omit<
    UseInfiniteQueryOpts<TInput, TPage, TQueryKey, TFullPage>,
    "arrange"
  >;

  // Custom onWSData with query cache actions
  onData?: (opts: Prettify<WSEventContext<TData> & { event?: string }>) => void;
}
