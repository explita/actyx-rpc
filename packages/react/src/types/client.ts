import {
  ErrorResponse,
  ExtractPaginatedItem,
  ExtractProcInput,
  ExtractProcOutput,
  InfiniteQueryPage,
  InfiniteQueryResult,
  IsPaginated,
  MaybePromise,
  MutationResult,
  Prettify,
  QueryData,
  QueryResult,
  SSEAdapterOptions,
  Unwrap,
  UseInfiniteQueryOpts,
  UseMutationOpts,
  UseMutationResult,
  UseQueryOpts,
  UseSSEOpts,
  UseSSEResult,
  UseSuspenseQueryResult,
  UseWSOpts,
  UseWSResult,
  WindowTime,
  WSAdapterOptions,
} from "./main";
import { SSEEvent } from "./misc";

export interface InterceptorRequestContext {
  url: string;
  procedure: string;
  input: any;
  method: string;
  headers: Record<string, string>;
  options: Record<string, any>;
}

export interface InterceptorResponseContext {
  response: Response | any;
  procedure: string;
  input: any;
  retryCount: number;
  /**
   * Transparently retries the original request.
   * Optionally pass modified headers or request options to override for the retry.
   */
  retry: (customOptions?: {
    headers?: Record<string, string>;
    [key: string]: any;
  }) => Promise<[any, any]>;
}

export interface InterceptorErrorContext {
  error: any;
  procedure: string;
  input: any;
  retryCount: number;
  retry: (customOptions?: {
    headers?: Record<string, string>;
    [key: string]: any;
  }) => Promise<[any, any]>;
}

export interface ClientInterceptors {
  /**
   * Hook called before a request is dispatched.
   * Return modified headers or options to override for this request.
   */
  onRequest?: (
    ctx: InterceptorRequestContext,
  ) => MaybePromise<void | {
    headers?: Record<string, string>;
    [key: string]: any;
  }>;

  /**
   * Hook called when a response is received (both 2xx and non-2xx HTTP statuses).
   * Perfect for 401 session refreshes:
   * ```ts
   * async onResponse({ response, retry }) {
   *   if (response.status === 401) {
   *     await refreshSession();
   *     return retry();
   *   }
   * }
   * ```
   */
  onResponse?: (
    ctx: InterceptorResponseContext,
  ) => MaybePromise<void | [any, any] | any>;

  /**
   * Hook called when a fetch or network call throws an error.
   */
  onError?: (
    ctx: InterceptorErrorContext,
  ) => MaybePromise<void | [any, any] | any>;
}

export interface BatchOptions {
  /**
   * Time window in milliseconds to pool queries into a single batch request.
   * @default 10
   */
  delay?: number;
  /**
   * Maximum number of queries in a single batch request before triggering an immediate flush.
   * @default 50
   */
  maxBatchSize?: number;
}

export interface BatchMetrics {
  totalBatches: number;
  totalDispatched: number;
  totalWireItems: number;
  totalDeduplicated: number;
  lastBatch?: {
    timestamp: number;
    dispatchedCount: number;
    wireCount: number;
    dedupedCount: number;
    wirePayload: Array<{
      id: number;
      procedure: string;
      input?: any;
      args?: any[];
    }>;
    durationMs: number;
  };
}

export interface CreateClientOptions {
  baseUrl: string;
  headers?:
    | Record<string, string>
    | (() => MaybePromise<Record<string, string>>);
  fetch?: typeof fetch | ((url: string, init?: any) => Promise<any>) | any;
  /**
   * Procedure routing strategy in HTTP requests:
   * - "path": Appends the procedure path to baseUrl (e.g. `/api/trpc/posts.list`). Matches tRPC catch-all routes.
   * - "query": Appends procedure as a query parameter (e.g. `/api/rpc?procedure=posts.list`).
   *
   * @default "path"
   */
  routing?: "path" | "query";
  /**
   * Default HTTP method for queries (`useQuery`, `useSuspenseQuery`, `useInfiniteQuery`, `.query()`).
   *
   * @default "GET"
   */
  queryMethod?: "GET" | "POST";
  /**
   * Client request and response interceptors (e.g. for auth refresh loops).
   */
  interceptors?: ClientInterceptors;
  /**
   * Maximum number of automatic retries via interceptor retry() call.
   * @default 3
   */
  maxRetries?: number;
  /**
   * Enable HTTP request batching for queries dispatched in the same tick.
   * Can be boolean (`true`) or configured with `{ delay?: number, maxBatchSize?: number }`.
   * When enabled, concurrent queries dispatched within the delay window (default: 10ms)
   * are pooled into a single `POST /api/rpc?batch=1` request with network deduplication.
   *
   * @default false
   */
  batch?: boolean | BatchOptions;
}

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | (string & {});

export interface ClientHttpOpts {
  /**
   * HTTP method to use for the request.
   */
  method?: HttpMethod;
  /**
   * Custom request headers.
   */
  headers?: Record<string, string>;
  /**
   * Override request batching behavior for this specific call.
   * Set to `false` to force an immediate standalone HTTP connection.
   */
  batch?: boolean;
  /**
   * Custom signal for request cancellation.
   */
  signal?: AbortSignal;
  /**
   * Callback function for progress tracking (0-100).
   */
  onProgress?: (progress: number) => void;
}

export type ClientUseQueryOpts<
  TOutput,
  TQueryKey extends unknown[] = unknown[],
  TUnwrap extends boolean = false,
  TSelectData = Unwrap<TOutput, TUnwrap>,
> = Prettify<
  UseQueryOpts<TOutput, TQueryKey, TUnwrap, TSelectData> & ClientHttpOpts
>;

export type ClientUseInfiniteQueryOpts<
  TQueryFnData,
  TPage,
  TQueryKey extends unknown[] = unknown[],
  TFullPage = InfiniteQueryPage<TPage>,
  TArgs extends any[] = any[],
> = Prettify<
  UseInfiniteQueryOpts<TQueryFnData, TPage, TQueryKey, TFullPage, TArgs> &
    ClientHttpOpts
>;

export type ClientUseMutationOpts<
  TOutput,
  TArgs extends any[] = any[],
  TContext = unknown,
  TMutationKey extends unknown[] = unknown[],
> = Prettify<
  UseMutationOpts<TOutput, TArgs, TContext, TMutationKey> & ClientHttpOpts
>;

export type StreamTarget = string | ((...args: any[]) => any);

export type ClientUseSSEInfiniteQueryOpts<
  TInput,
  TData,
  TQueryKey extends unknown[] = unknown[],
  TFullPage = InfiniteQueryPage<TData>,
> = Prettify<
  Omit<SSEAdapterOptions<TInput, TData, TData, TQueryKey, TFullPage>, "url"> & {
    /**
     * The streaming procedure (e.g. `rpc.notifications.sse` or `rpc.feed.stream`)
     * or a direct URL string to listen to for incoming real-time SSE events.
     */
    stream: StreamTarget;
  }
>;

export type ClientUseWSInfiniteQueryOpts<
  TInput,
  TData,
  TQueryKey extends unknown[] = unknown[],
  TFullPage = InfiniteQueryPage<TData>,
  TArgs extends any[] = any[],
> = Prettify<
  Omit<
    WSAdapterOptions<TInput, TData, TData, TQueryKey, TFullPage, TArgs>,
    "url"
  > & {
    /**
     * The WebSocket procedure (e.g. `rpc.chat.ws`) or a direct WebSocket URL string
     * to connect to for incoming real-time events.
     */
    ws: StreamTarget;
  }
>;

export type ClientUseSSEResult<
  TPage,
  TFullPage = InfiniteQueryPage<TPage>,
  TData = TPage,
> = Prettify<
  InfiniteQueryResult<TPage, TFullPage> & {
    lastData: TData | undefined;
    event: string | undefined;
    isConnected: boolean;
    close: () => void;
    clear: () => void;
  }
>;

export type ClientUseWSResult<
  TPage,
  TFullPage = InfiniteQueryPage<TPage>,
  TData = TPage,
> = Prettify<
  InfiniteQueryResult<TPage, TFullPage> & {
    send: (data: any) => void;
    unsubscribe: () => void;
    status: "idle" | "connecting" | "connected" | "error";
    queryError: ErrorResponse | null;
  }
>;

export type QueryCall<T = unknown> = Promise<[T, null] | [null, ErrorResponse]>;

export type ClientQueryCall<I, O, P extends unknown[] = []> = [I] extends
  | [void]
  | [undefined]
  | [never]
  ? {
      (...args: P): QueryCall<O>;
      (opts: ClientHttpOpts, ...args: P): QueryCall<O>;
      useQuery: {
        <
          TUnwrap extends boolean = false,
          TSelectData = Unwrap<O, TUnwrap>,
          TInitialData extends QueryData<Unwrap<O, TUnwrap>> = QueryData<
            Unwrap<O, TUnwrap>
          >,
        >(
          opts: ClientUseQueryOpts<O, unknown[], TUnwrap, TSelectData> & {
            initialData: TInitialData;
            input?: undefined;
          },
          ...args: P
        ): QueryResult<O, TInitialData, TUnwrap, TSelectData>;
        <
          TUnwrap extends boolean = false,
          TInitialData extends undefined = undefined,
          TSelectData = Unwrap<O, TUnwrap>,
        >(
          opts?:
            | (ClientUseQueryOpts<O, unknown[], TUnwrap, TSelectData> & {
                initialData?: undefined;
                input?: undefined;
              })
            | undefined,
          ...args: P
        ): QueryResult<O, TInitialData, TUnwrap, TSelectData>;
      };
      useSuspenseQuery: <
        TUnwrap extends boolean = false,
        TSelectData = Unwrap<O, TUnwrap>,
      >(
        opts?:
          | (Omit<
              ClientUseQueryOpts<O, unknown[], TUnwrap, TSelectData>,
              "initialData" | "enabled"
            > & { input?: undefined })
          | undefined,
        ...args: P
      ) => UseSuspenseQueryResult<O, TUnwrap, TSelectData>;
      invalidate: {
        (): void;
        (opts?: unknown[] | { queryKey?: unknown[] }): void;
        (...args: Partial<P>): void;
      };
      getQueryKey: (opts?: { queryKey?: unknown[] }, ...args: P) => unknown[];
      isFetching: (opts?: { queryKey?: unknown[] }, ...args: P) => boolean;
      useIsFetching: (opts?: { queryKey?: unknown[] }, ...args: P) => boolean;
      getQueryData: (
        opts?: { queryKey?: unknown[] },
        ...args: P
      ) => O | undefined;
      setQueryData: (
        updater: O | ((oldData: O | undefined) => O),
        opts?: { queryKey?: unknown[] },
        ...args: P
      ) => [O | undefined, O];
      prefetch: (
        opts?: ClientHttpOpts & {
          queryKey?: unknown[];
          staleTime?: WindowTime;
        },
        ...args: P
      ) => Promise<void>;
      reset: (opts?: { queryKey?: unknown[] }, ...args: P) => void;
    } & (IsPaginated<O> extends true
      ? {
          useInfiniteQuery: (
            opts?:
              | ClientUseInfiniteQueryOpts<
                  any,
                  ExtractPaginatedItem<O>,
                  unknown[],
                  O,
                  P
                >
              | undefined,
            ...args: P
          ) => InfiniteQueryResult<ExtractPaginatedItem<O>, O>;
          usePaginatedQuery: (
            opts?:
              | (ClientUseInfiniteQueryOpts<
                  any,
                  ExtractPaginatedItem<O>,
                  unknown[],
                  O,
                  P
                > & {
                  input?: undefined;
                })
              | undefined,
            ...args: P
          ) => InfiniteQueryResult<ExtractPaginatedItem<O>, O>;
          useSSEInfiniteQuery: (
            opts: ClientUseSSEInfiniteQueryOpts<
              any,
              ExtractPaginatedItem<O>,
              unknown[],
              O
            > & {
              input?: undefined;
            },
            ...args: P
          ) => ClientUseSSEResult<ExtractPaginatedItem<O>, O>;
          useWSInfiniteQuery: (
            opts: ClientUseWSInfiniteQueryOpts<
              any,
              ExtractPaginatedItem<O>,
              unknown[],
              O,
              P
            > & {
              input?: undefined;
            },
            ...args: P
          ) => ClientUseWSResult<ExtractPaginatedItem<O>, O>;
        }
      : {})
  : {
      (input: I, ...args: P): QueryCall<O>;
      (input: I, opts: ClientHttpOpts, ...args: P): QueryCall<O>;
      useQuery: {
        <
          TUnwrap extends boolean = false,
          TSelectData = Unwrap<O, TUnwrap>,
          TInitialData extends QueryData<Unwrap<O, TUnwrap>> = QueryData<
            Unwrap<O, TUnwrap>
          >,
        >(
          opts: ClientUseQueryOpts<O, unknown[], TUnwrap, TSelectData> & {
            initialData: TInitialData;
            input: I;
          },
          ...args: P
        ): QueryResult<O, TInitialData, TUnwrap, TSelectData>;
        <
          TUnwrap extends boolean = false,
          TInitialData extends undefined = undefined,
          TSelectData = Unwrap<O, TUnwrap>,
        >(
          opts: ClientUseQueryOpts<O, unknown[], TUnwrap, TSelectData> & {
            initialData?: undefined;
            input: I;
          },
          ...args: P
        ): QueryResult<O, TInitialData, TUnwrap, TSelectData>;
      };
      useSuspenseQuery: <
        TUnwrap extends boolean = false,
        TSelectData = Unwrap<O, TUnwrap>,
      >(
        opts: Omit<
          ClientUseQueryOpts<O, unknown[], TUnwrap, TSelectData>,
          "initialData" | "enabled"
        > & { input: I },
        ...args: P
      ) => UseSuspenseQueryResult<O, TUnwrap, TSelectData>;
      invalidate: {
        (): void;
        (
          inputOrOpts?:
            | unknown[]
            | { input?: I; queryKey?: unknown[] }
            | Partial<I>,
          ...args: Partial<P>
        ): void;
      };
      getQueryKey: (
        input?: I | { input?: I; queryKey?: unknown[] },
        ...args: P
      ) => unknown[];
      isFetching: (
        input?: I | { input?: I; queryKey?: unknown[] },
        ...args: P
      ) => boolean;
      useIsFetching: (
        input?: I | { input?: I; queryKey?: unknown[] },
        ...args: P
      ) => boolean;
      getQueryData: (
        input?: I | { input?: I; queryKey?: unknown[] },
        ...args: P
      ) => O | undefined;
      setQueryData: {
        (
          input: I,
          updater: O | ((oldData: O | undefined) => O),
          opts?: { queryKey?: unknown[] },
          ...args: P
        ): [O | undefined, O];
        (
          updater: O | ((oldData: O | undefined) => O),
          opts: { input: I; queryKey?: unknown[] },
          ...args: P
        ): [O | undefined, O];
      };
      prefetch: (
        input: I,
        opts?: ClientHttpOpts & {
          queryKey?: unknown[];
          staleTime?: WindowTime;
        },
        ...args: P
      ) => Promise<void>;
      reset: (
        input?: I | { input?: I; queryKey?: unknown[] },
        ...args: P
      ) => void;
    } & (IsPaginated<O> extends true
      ? {
          useInfiniteQuery: (
            opts: ClientUseInfiniteQueryOpts<
              I,
              ExtractPaginatedItem<O>,
              unknown[],
              O,
              P
            > & {
              input: I | ((pageParam: any) => I);
            },
            ...args: P
          ) => InfiniteQueryResult<ExtractPaginatedItem<O>, O>;
          usePaginatedQuery: (
            opts: ClientUseInfiniteQueryOpts<
              I,
              ExtractPaginatedItem<O>,
              unknown[],
              O,
              P
            > & {
              input: I | ((pageParam: any) => I);
            },
            ...args: P
          ) => InfiniteQueryResult<ExtractPaginatedItem<O>, O>;
          useSSEInfiniteQuery: (
            opts: ClientUseSSEInfiniteQueryOpts<
              I,
              ExtractPaginatedItem<O>,
              unknown[],
              O
            > & {
              input: I | ((pageParam: any) => I);
            },
            ...args: P
          ) => ClientUseSSEResult<ExtractPaginatedItem<O>, O>;
          useWSInfiniteQuery: (
            opts: ClientUseWSInfiniteQueryOpts<
              I,
              ExtractPaginatedItem<O>,
              unknown[],
              O,
              P
            > & {
              input: I | ((pageParam: any) => I);
            },
            ...args: P
          ) => ClientUseWSResult<ExtractPaginatedItem<O>, O>;
        }
      : {});

export type MutationCall<I, O, P extends unknown[] = []> = ([I] extends
  | [void]
  | [undefined]
  | [never]
  ? {
      (...args: P): Promise<MutationResult<O>>;
      useMutation: <TContext = unknown>(
        opts?: ClientUseMutationOpts<O, P, TContext>,
      ) => UseMutationResult<O, P, TContext, any>;
    }
  : {
      (input: I, ...args: P): Promise<MutationResult<Awaited<O>>>;
      useMutation: <TContext = unknown>(
        opts?: ClientUseMutationOpts<O, [I, ...P], TContext>,
      ) => UseMutationResult<O, [I, ...P], TContext, any>;
    }) & {
  isMutating: (
    inputOrOpts?: I | { input?: I; queryKey?: unknown[] },
    ...args: P
  ) => boolean;
  useIsMutating: (
    inputOrOpts?: I | { input?: I; queryKey?: unknown[] },
    ...args: P
  ) => boolean;
  getMutationKey: (
    inputOrOpts?: I | { input?: I; queryKey?: unknown[] },
    ...args: P
  ) => unknown[];
  getQueryKey: (
    inputOrOpts?: I | { input?: I; queryKey?: unknown[] },
    ...args: P
  ) => unknown[];
};

export type IsEmptyOrOptionalInput<T> = [T] extends
  | [void]
  | [undefined]
  | [never]
  ? true
  : [unknown] extends [T]
    ? true
    : [undefined] extends [T]
      ? true
      : false;

export type StreamCall<
  I,
  O,
  P extends unknown[] = [],
> = (IsEmptyOrOptionalInput<I> extends true
  ? (...args: P) => AsyncIterable<O> & { close: () => void }
  : (input: I, ...args: P) => AsyncIterable<O> & { close: () => void }) & {
  useSSE: IsEmptyOrOptionalInput<I> extends true
    ? (
        opts?: Prettify<Omit<UseSSEOpts<O>, "url">>,
        ...args: P
      ) => UseSSEResult<O>
    : (
        opts: Prettify<
          Omit<UseSSEOpts<O>, "url"> & {
            input: I;
          }
        >,
        ...args: P
      ) => UseSSEResult<O>;
};

export type SSECall<I, O, P extends unknown[] = []> = StreamCall<I, O, P>;

export type WSCall<I, P extends unknown[] = []> = {
  useWS: [I] extends [void] | [undefined] | [never]
    ? <TOutput = any>(
        opts?: Omit<UseWSOpts<TOutput>, "url">,
        ...args: P
      ) => UseWSResult<TOutput>
    : <TOutput = any>(
        opts: Prettify<
          Omit<UseWSOpts<TOutput>, "url"> & {
            input: I;
          }
        >,
        ...args: P
      ) => UseWSResult<TOutput>;
};

export type InferProcArgs<FnArgs extends unknown[]> = FnArgs extends []
  ? { input: undefined; args: [] }
  : FnArgs extends [infer First, ...infer Rest]
    ? { input: First; args: Rest }
    : FnArgs extends [(infer First)?, ...infer Rest]
      ? { input: First; args: Rest }
      : { input: undefined; args: [] };

export type ClientRouterMethods<T> = {
  [K in keyof T as T[K] extends {
    _def: { type: "webRoute" };
  }
    ? never
    : T[K] extends (req: Request, ...args: any[]) => Promise<Response>
      ? never
      : K]: T[K] extends {
    _def: { type: "query"; input: infer I; output: infer O; args?: infer P };
  }
    ? ClientQueryCall<I, O, P extends unknown[] ? P : []>
    : T[K] extends {
          _def: {
            type: "mutation";
            input: infer I;
            output: infer O;
            args?: infer P;
          };
        }
      ? MutationCall<I, O, P extends unknown[] ? P : []>
      : T[K] extends {
            _def: {
              type: "stream" | "sse";
              input: infer I;
              output: infer O;
              args?: infer P;
            };
          }
        ? StreamCall<I, O, P extends unknown[] ? P : []>
        : T[K] extends {
              _def: {
                type: "ws";
                input: infer I;
                args?: infer P;
              };
            }
          ? WSCall<I, P extends unknown[] ? P : []>
          : T[K] extends (
                ...args: infer FnArgs
              ) => Promise<infer R & { readonly _type?: "query" }>
            ? ExtractProcInput<R> extends infer I
              ? [I] extends [undefined] | [void] | [never]
                ? ClientQueryCall<undefined, ExtractProcOutput<R>, FnArgs>
                : ClientQueryCall<
                    I,
                    ExtractProcOutput<R>,
                    FnArgs extends [any, ...infer Rest] ? Rest : []
                  >
              : never
            : T[K] extends (
                  ...args: infer FnArgs
                ) => Promise<infer R & { readonly _type?: "mutation" }>
              ? ExtractProcInput<R> extends infer I
                ? [I] extends [undefined] | [void] | [never]
                  ? MutationCall<undefined, ExtractProcOutput<R>, FnArgs>
                  : MutationCall<
                      I,
                      ExtractProcOutput<R>,
                      FnArgs extends [any, ...infer Rest] ? Rest : []
                    >
                : never
              : T[K] extends (
                    ...args: infer FnArgs
                  ) => AsyncIterable<SSEEvent<infer O, any>>
                ? InferProcArgs<FnArgs> extends {
                    input: infer I;
                    args: infer P;
                  }
                  ? SSECall<I, O, P extends unknown[] ? P : []>
                  : never
                : T[K] extends (...args: infer FnArgs) => AsyncIterable<infer O>
                  ? InferProcArgs<FnArgs> extends {
                      input: infer I;
                      args: infer P;
                    }
                    ? StreamCall<
                        I,
                        O extends SSEEvent<infer Data, any> ? Data : O,
                        P extends unknown[] ? P : []
                      >
                    : never
                  : T[K] extends (
                        ...args: infer FnArgs
                      ) => (wsContext: any) => Promise<void>
                    ? InferProcArgs<FnArgs> extends {
                        input: infer I;
                        args: infer P;
                      }
                      ? WSCall<I, P extends unknown[] ? P : []>
                      : never
                    : ClientRouterMethods<T[K]>;
};

export type ClientInstance<T> = ClientRouterMethods<T> & {
  /**
   * Real-time batching and link deduplication metrics.
   *
   * @example
   * ```ts
   * const metrics = rpc.$batch();
   * console.log(metrics.totalBatches, metrics.totalDeduplicated);
   * ```
   */
  $batch: () => BatchMetrics;
  // /**
  //  * Alias for `$batch()`. Returns real-time batching and link deduplication metrics.
  //  */
  // getBatchMetrics: () => BatchMetrics;
};
