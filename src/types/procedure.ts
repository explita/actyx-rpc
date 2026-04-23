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
  FailureReason,
  InputCtx,
  InputMode,
  InputParams,
  MaybePromise,
  MutationResult,
  PlusMeta,
  Prettify,
  QueryResult,
  SchemaResolver,
} from "./misc.js";

export type ProcedureConfig<
  TCtx,
  TEnrich,
  TMeta extends Record<string, any> = {},
> = {
  name?: string;
  resolver?: SchemaResolver<any>;
  middlewares?: Middleware<TCtx, TEnrich, any, any>[];
  plugins?: Plugin<TCtx, TEnrich, any, any>[];
  cache?: CacheConfig;
  invalidate?: CacheInvalidationConfig;
  retry?: RetryConfig;
  timeout?: TimeoutConfig;
  circuitBreaker?: CircuitBreakerConfig & { state?: any };
  compression?: CompressorConfig;
  rateLimit?: RateLimitConfig;
  telemetry?: boolean;
  meta?: TMeta;
};

export type ProcedureInstance<
  Ctx,
  TEnrich,
  TMeta extends Record<string, any>,
  I = void,
  ICtx extends InputCtx = InputCtx,
  GIM extends InputMode = InputMode, //Global Input Mode
> = {
  name: (
    name: string,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM>,
    "extend" | "name"
  >;
  meta: <NextMeta extends Record<string, any>>(
    meta: NextMeta,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, Prettify<TMeta & NextMeta>, I, ICtx, GIM>,
    "extend" | "meta"
  >;
  circuitBreaker: (
    options?: CircuitBreakerOptions,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM>,
    "circuitBreaker"
  >;
  telemetry: () => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM>,
    "telemetry"
  >;
  use: (<NextCtx = Ctx>(
    mw: Middleware<
      Ctx,
      TEnrich,
      [I] extends [void] ? TEnrich : Prettify<I & TEnrich>,
      NextCtx
    >,
  ) => Omit<
    ProcedureInstance<Prettify<Ctx & NextCtx>, TEnrich, TMeta, I, ICtx, GIM>,
    "input" | "extend" | "middleware" | "plugin"
  >) &
    (<NextCtx = Ctx>(
      plugin: Plugin<
        Ctx,
        TEnrich,
        [I] extends [void] ? TEnrich : Prettify<I & TEnrich>,
        NextCtx
      >,
    ) => Omit<
      ProcedureInstance<Prettify<Ctx & NextCtx>, TEnrich, TMeta, I, ICtx, GIM>,
      "input" | "extend" | "middleware" | "plugin"
    >);

  middleware: <NextCtx = Ctx>(
    mw: Middleware<
      Ctx,
      TEnrich,
      [I] extends [void] ? TEnrich : Prettify<I & TEnrich>,
      NextCtx
    >,
  ) => typeof mw;

  plugin: <NextCtx = Ctx>(
    plugin: Plugin<
      Ctx,
      TEnrich,
      [I] extends [void] ? TEnrich : Prettify<I & TEnrich>,
      NextCtx
    >,
  ) => typeof plugin;

  input: <T, NextICtx extends InputCtx>(
    resolver: SchemaResolver<T>,
    options?: NextICtx,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, T, NextICtx, GIM>,
    "input" | "extend" | "middleware" | "plugin" | "meta"
  >;

  mutation: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: Prettify<Ctx & BaseContext & { meta: TMeta }>;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => T,
  ) => (
    data: InputParams<I, ICtx, GIM>,
    ...args: P
  ) => Promise<MutationResult<Awaited<T>>>;

  query: <T, P extends unknown[]>(
    handler: (
      opts: {
        ctx: Prettify<Ctx & BaseContext & { meta: TMeta }>;
        input: [I] extends [void] ? TEnrich : Prettify<I & TEnrich>;
      },
      ...args: P
    ) => T,
  ) => (
    input: InputParams<I, ICtx, GIM>,
    ...args: P
  ) => Promise<QueryResult<Awaited<T>>>;

  extend: <
    NextCtx = Ctx,
    NextEnrich = TEnrich,
    NextMeta extends Record<string, any> = {},
  >(
    config: Omit<
      Partial<ProcedureProps<Ctx, TEnrich, GIM, NextMeta>>,
      "createContext" | "enrichInput"
    > &
      ProcedureExtensionConfig<Ctx, TEnrich, NextCtx, NextEnrich, TMeta>,
  ) => ProcedureInstance<
    NextCtx,
    NextEnrich,
    Prettify<TMeta & NextMeta>,
    I,
    ICtx,
    GIM
  >;

  cache: <TInput = I>(
    options?: WithCacheOptions<Prettify<Ctx & TEnrich>, TInput>,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM>,
    "query" | "mutation" | "retry" | "timeout" | "rateLimit"
  >;

  invalidate: (
    options: CacheInvalidationOptions<Ctx, I>,
  ) => Pick<ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM>, "mutation">;

  retry: (
    options?: RetryOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM>,
    "query" | "cache" | "timeout" | "rateLimit"
  >;

  timeout: (
    options?: TimeoutOptions,
  ) => Pick<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM>,
    "query" | "mutation" | "retry" | "cache" | "rateLimit"
  >;

  compress: (
    options?: CompressionOptions,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM>,
    "compress" | "extend" | "middleware" | "plugin" | "input" | "meta"
  >;

  rateLimit: (
    options?: RateLimitOptions<Ctx>,
  ) => Omit<
    ProcedureInstance<Ctx, TEnrich, TMeta, I, ICtx, GIM>,
    "rateLimit" | "input" | "middleware" | "plugin" | "extend" | "meta"
  >;
};

export type ProcedureExtensionConfig<
  TCtx,
  TEnrich,
  TNextCtx,
  TNextEnrich,
  TMeta extends Record<string, any> = {},
> = {
  createContext?: (
    ctx: Prettify<TCtx & { meta: TMeta } & BaseContext>,
  ) => Promise<ContextResult<TNextCtx>> | ContextResult<TNextCtx>;
  enrichInput?: (options: {
    previous: TEnrich;
    ctx: TNextCtx;
  }) => Promise<TNextEnrich> | TNextEnrich;
};

export type ProcedureProps<
  TCtx,
  TEnrich,
  GIM extends InputMode = InputMode,
  TMeta extends Record<string, any> = {},
> = {
  createContext: (
    prevCtx: Prettify<BaseContext & PlusMeta<TMeta>>,
  ) => MaybePromise<ContextResult<TCtx>>;
  onContextError?: (options: {
    reason: FailureReason;
    ctx: Prettify<TCtx & PlusMeta<TMeta>>;
  }) => Promise<Partial<ErrorResponse> | void> | Partial<ErrorResponse> | void;
  enrichInput: (
    ctx: Prettify<TCtx & PlusMeta<TMeta>>,
  ) => Promise<TEnrich> | TEnrich;
  onError?: (props: {
    error: any;
    ctx: Prettify<TCtx & PlusMeta<TMeta>>;
    input: any;
    args: any[];
  }) => MaybePromise<Partial<ErrorResponse> | void>;
  onSuccess?: (props: {
    ctx: Prettify<TCtx & PlusMeta<TMeta>>;
    input: any;
    output: any;
    duration: number;
    args: any[];
  }) => MaybePromise<void>;
  middlewares?: Middleware<any, any, any, any>[];
  plugins?: Plugin<any, any, any, any>[];
  inputMode?: GIM;
  cache?: CacheAdapter;
  compression?: Compressor;
  meta?: TMeta;
};
