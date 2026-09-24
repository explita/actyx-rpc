export * from "./hooks/use-mutation.js";
export * from "./hooks/use-query.js";
export * from "./hooks/use-suspense-query.js";
export * from "./hooks/use-paginated-query.js";
export * from "./hooks/use-infinite-query.js";
export * from "./hooks/use-is-mutating.js";
export * from "./hooks/use-is-fetching.js";
export * from "./hooks/use-queries.js";
export * from "./hooks/use-sse.js";
export * from "./hooks/use-ws.js";
export * from "./hooks/use-ws-infinite-query.js";
export * from "./hooks/use-sse-infinite-query.js";
export * from "./provider.js";
export * from "./lib/query-client.js";
export * from "./hydration/hydration-boundary.js";
export * from "./devtools/index.js";

export * from "./client/index.js";

export type {
  InfiniteQueryPage,
  ExtractInfinitePage,
  ExtractInfiniteItem,
  ExtractProcOutput,
  ExtractProcInput,
  ExtractTupleData,
  IsPaginated,
  ExtractPaginatedItem,
  UseInfiniteQueryOpts,
  InfiniteQueryResult,

  UseMutationOpts,
  UseMutationResult,
  MutationStatus,
  QueryResult,
  MutationResult,
  ErrorResponse,
  FailureReason,
  WindowTime,
  UseQueryOpts,
  UseQueriesItem,
  UseQueriesResult,
  QueriesResults,
  UseSSEOpts,
  UseSSEResult,
  UseWSOpts,
  UseWSResult,
  WSAdapterOptions,
  WSEventContext,
  SSEAdapterOptions,
} from "./types/main.js";
export type {
  CreateClientOptions,
  ClientInterceptors,
  InterceptorRequestContext,
  InterceptorResponseContext,
  InterceptorErrorContext,
  ClientInstance,
} from "./types/client.js";
export * from "./types/query-client.js";
