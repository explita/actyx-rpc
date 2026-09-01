import type {
  CacheAdapter,
  CacheConfig,
  CacheInvalidationConfig,
  CacheInvalidationOptions,
  RateLimitConfig,
  RateLimitOptions,
  WithCacheOptions,
} from "../core/cache/types.js";
import type {
  CircuitBreakerConfig,
  CircuitBreakerOptions,
} from "../core/circuit-breaker/types.js";
import { Compressor } from "../core/compression/compressor.js";
import type {
  CompressionOptions,
  CompressorConfig,
} from "../core/compression/types.js";
import type { RetryConfig, RetryOptions } from "../core/retry/types.js";
import type { TimeoutConfig, TimeoutOptions } from "../core/timeout/types.js";
import type { Middleware, Plugin } from "./middleware.js";
import type {
  BaseContext,
  ContextResult,
  ErrorResponse,
  ExtraCtx,
  FailureReason,
  InputCtx,
  InputMode,
  InputParams,
  MaybePromise,
  MergeMeta,
  MutationResult,
  PlusMeta,
  Prettify,
  QueryResult,
  SchemaResolver,
  SSEEvent,
} from "./misc.js";

export interface ProcedureDefinition<TType extends string, TInput, TOutput> {
  _def: {
    type: TType;
    input: TInput;
    output: TOutput;
  };
}

export type ProcedureConfig<
  TCtx,
  TEnrich,
  TMeta extends Record<string, any> = {},
> = {
  name: string;
  type?:
    | "mutation"
    | "query"
    | "webRoute"
    | "stream"
    | "sse"
    | "ws"
    | "subscription";
  resolver?: SchemaResolver<any>;
  outputResolver?: SchemaResolver<any>;
  middlewares?: Middleware<TCtx, TEnrich, any, any, TMeta>[];
  plugins?: Plugin<TCtx, TEnrich, any, any, TMeta>[];
  cache?: CacheConfig;
  invalidate?: CacheInvalidationConfig;
  retry?: RetryConfig;
  timeout?: TimeoutConfig;
  circuitBreaker?: CircuitBreakerConfig & { state?: any };
  compression?: CompressorConfig;
  rateLimit?: RateLimitConfig;
  telemetry?: boolean;
  meta?: TMeta;
  authorize?: (
    ctx: MergeMeta<TCtx, BaseContext<TMeta>>,
    req: Request,
    context: any,
  ) => MaybePromise<boolean | Partial<ErrorResponse>>;
  mock?: (
    opts: {
      ctx: MergeMeta<TCtx, BaseContext<TMeta>>;
      input: TEnrich;
    },
    req: Request,
    context: any,
  ) => unknown;
  summary?: string;
  description?: string;
};

export interface ProcedureInstance<
  Ctx,
  TEnrich,
  TMeta extends Record<string, any>,
  I = void,
  ICtx extends InputCtx = InputCtx,
  GIM extends InputMode = InputMode, //Global Input Mode
  TName extends string = string,
  TMocked extends boolean = false,
> {
  // Configurable meta data
  name: <NextName extends string>(
    name: NextName,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, NextName, TMocked>,
    "extend" | "name"
  >;
  meta: <NextMeta extends Record<string, any>>(
    meta: NextMeta,
  ) => Omit<
    ProcedureInstance<
      Prettify<Ctx>,
      TEnrich,
      Prettify<TMeta & NextMeta>,
      I,
      ICtx,
      GIM,
      TName,
      TMocked
    >,
    "extend" | "meta"
  >;
  summary: (
    text: string,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "summary"
  >;
  description: (
    text: string,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "description" | "summary"
  >;
  output: (
    resolver: SchemaResolver<any>,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "output" | "description" | "summary"
  >;

  // Validation
  input: <T, NextICtx extends InputCtx>(
    resolver: SchemaResolver<T>,
    options?: NextICtx,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, T, NextICtx, GIM, TName, TMocked>,
    "input" | "extend" | "middleware" | "plugin" | "name" | "meta"
  >;
  invalidate: (
    options: CacheInvalidationOptions<
      Prettify<MergeMeta<Ctx, BaseContext<TMeta, TName>>>,
      [I] extends [void] ? TEnrich : Prettify<TEnrich & I>
    >,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "mutation" | "webRoute"
  >;

  // Authorization
  authorize: (
    checker: (
      ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>,
      req: Request,
      context: any,
    ) => MaybePromise<boolean | Partial<ErrorResponse>>,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    "input" | "extend" | "middleware" | "plugin" | "name" | "meta" | "authorize"
  >;

  // Resilience
  circuitBreaker: (
    options?: CircuitBreakerOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;
  cache: (
    options?: WithCacheOptions<
      Prettify<MergeMeta<Ctx, BaseContext<TMeta, TName>>>,
      [I] extends [void] ? TEnrich : Prettify<TEnrich & I>
    >,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  retry: (
    options?: RetryOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  timeout: (
    options?: TimeoutOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "retry"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  compress: (
    options?: CompressionOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "rateLimit"
    | "circuitBreaker"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  rateLimit: (
    options?: RateLimitOptions<Ctx, I, TMeta, TName>,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "circuitBreaker"
    | "telemetry"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  // Mocking
  mock: <T = unknown>(
    handler: (
      opts: {
        ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      req: Request,
      context: any,
    ) => MaybePromise<T>,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, true>,
    | "input"
    | "extend"
    | "middleware"
    | "plugin"
    | "name"
    | "meta"
    | "mock"
    | "ws"
  >;

  // Telemetry
  telemetry: () => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM, TName, TMocked>,
    | "query"
    | "mutation"
    | "webRoute"
    | "cache"
    | "invalidate"
    | "retry"
    | "timeout"
    | "compress"
    | "rateLimit"
    | "circuitBreaker"
    | "authorize"
    | "mock"
    | "stream"
    | "output"
  >;

  // Middleware/Plugins
  use: (<NextCtx = Ctx>(
    mw: Middleware<
      Ctx,
      TEnrich,
      [I] extends [void] ? TEnrich : Prettify<I & TEnrich>,
      NextCtx,
      TMeta,
      TName
    >,
  ) => Omit<
    ProcedureInstance<
      Prettify<Ctx & NextCtx>,
      TEnrich,
      TMeta,
      I,
      ICtx,
      GIM,
      TName,
      TMocked
    >,
    "input" | "extend" | "middleware" | "plugin" | "name" | "meta"
  >) &
    (<NextCtx = Ctx>(
      plugin: Plugin<
        Ctx,
        TEnrich,
        [I] extends [void] ? TEnrich : Prettify<I & TEnrich>,
        NextCtx,
        TMeta,
        TName
      >,
    ) => Omit<
      ProcedureInstance<
        Prettify<Ctx & NextCtx>,
        TEnrich,
        TMeta,
        I,
        ICtx,
        GIM,
        TName,
        TMocked
      >,
      "input" | "extend" | "middleware" | "plugin" | "name" | "meta"
    >);

  /**
   * Declare a reusable middleware.
   *
   * - `middleware(mw)` infers `NextCtx` from `mw`'s return type.
   * - `middleware<ExpectedInput>()(mw)` additionally constrains `input` to
   *   `ExpectedInput`. The extra `()` is required because TypeScript cannot
   *   infer a trailing type parameter (`NextCtx`) while an earlier one
   *   (`ExpectedInput`) is supplied explicitly — the `()` defers `NextCtx`
   *   inference to the inner call.
   */
  middleware: {
    <NextCtx = Ctx>(
      mw: Middleware<
        Ctx,
        TEnrich,
        [I] extends [void] ? TEnrich : Prettify<I & TEnrich>,
        Prettify<NextCtx>,
        TMeta,
        TName
      >,
    ): typeof mw;
    <ExpectedInput = unknown>(
      ...args: []
    ): <NextCtx = Ctx>(
      mw: Middleware<
        Ctx,
        TEnrich,
        [I] extends [void]
          ? Prettify<ExpectedInput & TEnrich>
          : Prettify<I & TEnrich>,
        Prettify<NextCtx>,
        TMeta,
        TName
      >,
    ) => typeof mw;
  };

  plugin: {
    <NextCtx = Ctx>(
      plugin: Plugin<
        Ctx,
        TEnrich,
        [I] extends [void] ? TEnrich : Prettify<I & TEnrich>,
        NextCtx,
        TMeta,
        TName
      >,
    ): typeof plugin;
    <ExpectedInput = unknown>(
      ...args: []
    ): <NextCtx = Ctx>(
      plugin: Plugin<
        Ctx,
        TEnrich,
        [I] extends [void]
          ? Prettify<ExpectedInput & TEnrich>
          : Prettify<I & TEnrich>,
        NextCtx,
        TMeta,
        TName
      >,
    ) => typeof plugin;
  };

  // Terminals
  mutation: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => T,
  ) => ([I] extends [void]
    ? // No input - just pass through args
      (...args: P) => Promise<MutationResult<Awaited<T>>>
    : // Has input - first arg is input, then optional args
      [TMocked] extends [true]
      ? (
          input?: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => Promise<MutationResult<Awaited<T>>>
      : (
          input: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => Promise<MutationResult<Awaited<T>>>) &
    ProcedureDefinition<
      "mutation",
      [I] extends [void] ? undefined : InputParams<I, ICtx, GIM>,
      Awaited<T>
    >;

  query: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => T,
  ) => ([I] extends [void]
    ? // No input - just pass through args
      (...args: P) => Promise<QueryResult<Awaited<T>>>
    : // Has input - first arg is input, then optional args
      [TMocked] extends [true]
      ? (
          input?: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => Promise<QueryResult<Awaited<T>>>
      : (
          input: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => Promise<QueryResult<Awaited<T>>>) &
    ProcedureDefinition<
      "query",
      [I] extends [void] ? undefined : InputParams<I, ICtx, GIM>,
      Awaited<T>
    >;

  stream: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => AsyncIterable<T> | Iterable<T>,
  ) => ([I] extends [void]
    ? (...args: P) => AsyncIterable<T>
    : [TMocked] extends [true]
      ? (input?: InputParams<I, ICtx, GIM>, ...args: P) => AsyncIterable<T>
      : (input: InputParams<I, ICtx, GIM>, ...args: P) => AsyncIterable<T>) &
    ProcedureDefinition<
      "stream",
      [I] extends [void] ? undefined : InputParams<I, ICtx, GIM>,
      T
    >;

  sse: <O = any, P extends unknown[] = []>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => AsyncIterable<SSEEvent<O>> | Iterable<SSEEvent<O>>,
  ) => ([I] extends [void]
    ? // No input - just pass through args
      (...args: P) => AsyncIterable<SSEEvent<O>> & { close: () => void }
    : // Has input - first arg is input, then optional args
      [TMocked] extends [true]
      ? (
          input?: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => AsyncIterable<SSEEvent<O>> & { close: () => void }
      : (
          input: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => AsyncIterable<SSEEvent<O>> & { close: () => void }) &
    ProcedureDefinition<
      "sse",
      [I] extends [void] ? undefined : InputParams<I, ICtx, GIM>,
      O
    >;

  webRoute: <T>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      req: Request,
      options: any,
    ) => MaybePromise<T>,
  ) => ((req: Request, options: any) => Promise<Response>) &
    ProcedureDefinition<
      "webRoute",
      [I] extends [void] ? undefined : InputParams<I, ICtx, GIM>,
      Awaited<T>
    >;

  ws: <P extends unknown[] = []>(
    handler: (
      opts: {
        ctx: Prettify<
          MergeMeta<Ctx, BaseContext<TMeta, TName>> &
            ExtraCtx<
              MergeMeta<Ctx, BaseContext<TMeta, TName>>,
              [I] extends [void] ? TEnrich : Prettify<I & TEnrich>
            >
        >;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
        send: <T = any>(data: T) => void;
        broadcast: <T = any>(data: T) => void;
        onMessage: <T = any>(cb: (data: T) => void) => void;
        onClose: (cb: (evt: CloseEvent) => void) => void;
        onError: (cb: (err: Event) => void) => void;
      },
      ...args: P
    ) => MaybePromise<void>,
  ) => [I] extends [void]
    ? (...args: P) => (wsContext: any) => Promise<void>
    : [TMocked] extends [true]
      ? (
          input?: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => (wsContext: any) => Promise<void>
      : (
          input: InputParams<I, ICtx, GIM>,
          ...args: P
        ) => (wsContext: any) => Promise<void>;

  // Extend
  extend: <NextCtx = Ctx, NextEnrich = TEnrich, NextMeta = unknown>(
    config: Omit<
      Partial<
        ProcedureProps<Ctx, TEnrich, GIM, NextMeta, MergeMeta<TMeta, NextMeta>>
      >,
      "createContext" | "enrichInput"
    > &
      ProcedureExtensionConfig<
        Ctx,
        TEnrich,
        NextCtx,
        NextEnrich,
        TMeta,
        NextMeta
      >,
  ) => ProcedureInstance<
    NextCtx,
    NextEnrich,
    MergeMeta<TMeta, NextMeta>,
    I,
    ICtx,
    GIM,
    TName,
    TMocked
  >;

  // Context
  /**
   * Returns the current RPC context from `AsyncLocalStorage`.
   *
   * This is a zero-argument, fully-typed alternative to `getContext<T>()`.
   * The context type is inferred directly from this procedure's definition —
   * no generics needed at the call site.
   *
   * Must be called from within the synchronous or async call stack of a
   * procedure handler — throws otherwise.
   *
   * @example
   * ```ts
   * // services/customer.ts
   * import { procedure } from "../rpc";
   *
   * export async function getAllCustomers() {
   *   const ctx = procedure.context; // fully typed!
   *   return db.customer.findMany({ where: { companyId: ctx.company.id } });
   * }
   * ```
   */
  readonly context: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
}

export type ProcedureExtensionConfig<
  TCtx,
  TEnrich,
  TNextCtx,
  TNextEnrich,
  TMeta extends Record<string, any> = {},
  TNextMeta = unknown,
> = {
  createContext?: (
    ctx: MergeMeta<TCtx, PlusMeta<MergeMeta<TMeta, TNextMeta>>>,
    req: Request,
    context: any,
  ) => MaybePromise<ContextResult<TNextCtx>>;
  enrichInput?: (
    options: {
      previous: TEnrich;
      ctx: MergeMeta<
        Prettify<TCtx & TNextCtx>,
        PlusMeta<MergeMeta<TMeta, TNextMeta>>
      >;
    },
    req: Request,
    context: any,
  ) => MaybePromise<TNextEnrich>;
};

export type ProcedureProps<
  TCtx,
  TEnrich,
  GIM extends InputMode = InputMode,
  TMeta = unknown,
  TTotalMeta = TMeta,
> = {
  createContext: (
    prevCtx: unknown,
    req: Request,
    context: any,
  ) => MaybePromise<ContextResult<TCtx>>;
  onContextError?: (
    options: {
      reason: FailureReason;
      ctx: MergeMeta<TCtx, PlusMeta<TTotalMeta>>;
    },
    req: Request,
    context: any,
  ) => MaybePromise<
    Prettify<Partial<ErrorResponse> & { _redirect?: () => void }>
  >;
  enrichInput?: (
    ctx: MergeMeta<TCtx, PlusMeta<TTotalMeta>>,
    req: Request,
    context: any,
  ) => MaybePromise<TEnrich>;
  onError?: (
    props: {
      error: any;
      ctx: MergeMeta<TCtx, BaseContext<TTotalMeta>>;
      input: unknown;
      args: any[];
    },
    req: Request,
    context: any,
  ) => MaybePromise<Partial<ErrorResponse> | void>;
  onSuccess?: (
    props: {
      ctx: MergeMeta<TCtx, BaseContext<TTotalMeta>>;
      input: any;
      output: any;
      duration: number;
      args: any[];
    },
    req: Request,
    context: any,
  ) => MaybePromise<void>;
  middlewares?: Middleware<TCtx, NoInfer<TEnrich>, any, any, TTotalMeta>[];
  plugins?: Plugin<TCtx, NoInfer<TEnrich>, any, any, TTotalMeta>[];
  inputMode?: GIM;
  cache?: CacheAdapter;
  compression?: Compressor;
  meta?: TMeta;
};

/**
 * Infers the context type from a procedure instance.
 * Works exactly like Zod's `z.infer`.
 *
 * @example
 * type MyContext = InferContext<typeof myProcedure>;
 */
export type InferContext<T> =
  T extends ProcedureInstance<
    infer Ctx,
    infer TEnrich,
    infer Meta,
    infer I,
    any,
    any,
    infer Name,
    any
  >
    ? Prettify<
        MergeMeta<Ctx, BaseContext<Meta, Name>> &
          ExtraCtx<
            MergeMeta<Ctx, BaseContext<Meta, Name>>,
            [I] extends [void] ? TEnrich : Prettify<I & TEnrich>
          >
      >
    : unknown;
/**
 * Infers the final merged input type from a procedure instance.
 * (Includes both Zod input and enriched context fields)
 *
 * @example
 * type MyInput = InferInput<typeof myProcedure>;
 */
export type InferInput<T> =
  T extends ProcedureInstance<
    any,
    infer TEnrich,
    any,
    infer I,
    any,
    any,
    any,
    any
  >
    ? [I] extends [void]
      ? TEnrich
      : Prettify<I & TEnrich>
    : unknown;

/**
 * Infers the resolved return data type from a finalized procedure.
 * Extracts the `TOutput` from the internal `ProcedureDefinition` shape,
 * stripping away the tuple wrapper and error types.
 *
 * @example
 * ```ts
 * const getActiveChats = procedure.query(async () => {
 *   return { data: [...], hasMore: false };
 * });
 *
 * type ActiveChats = InferOutput<typeof getActiveChats>;
 * //   ^? { data: [...], hasMore: boolean }
 * ```
 */
export type InferOutput<T> = T extends { _def: { output: infer O } }
  ? O
  : never;
