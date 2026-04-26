export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type BaseError = {
  success: boolean;
  handlerName: string;
  statusCode: number;
};

export type MergeMeta<T, U> = Prettify<
  {
    [K in keyof T]: K extends keyof U
      ? U[K] extends never
        ? T[K]
        : U[K]
      : T[K];
  } & U
>;

export type BaseContext<TMeta, TName extends string = string> = {
  handlerName: TName;
  meta: TMeta;
};

export type PlusMeta<T> = {
  meta: Prettify<T>;
};

export type MaybePromise<T> = Promise<T> | T;

/**
 * The normalized result type returned by every resolver's parse function.
 */
export type ResolverResult<T> =
  | { success: true; data: T }
  | { success: false; errors: Record<string, string>; message?: string };

/**
 * A schema resolver wraps any validation library into a single unified
 * interface. Use `zodResolver()` or `resolver()` from `./resolvers` to
 * create one.
 */
export type SchemaResolver<T = unknown> = {
  parse: (
    data: Record<string, unknown>,
  ) => Promise<ResolverResult<T>> | ResolverResult<T>;
};

export type InputMode = "strict" | "form" | "partial" | "patch";

export type InputCtx = {
  /**
   * Controls the caller-side TypeScript shape for procedure input.
   *
   * This is currently a type-only option. It does not change runtime parsing
   * or validation behavior. Runtime validation still comes entirely from the
   * configured resolver.
   *
   * [strict] Uses the exact inferred schema shape at the call site.
   *
   * [patch] Uses a partial object shape with strict inferred types for each key.
   *
   * [form] Uses a loose object shape where every declared key is `unknown`.
   *
   * [partial] Uses a loose partial object shape for maximum surface area.
   *
   * @default "strict"
   */
  mode?: InputMode;
};

type ResolvedMode<
  GIM extends InputMode | undefined,
  ICtx extends InputCtx,
> = ICtx["mode"] extends InputMode
  ? ICtx["mode"]
  : [GIM] extends ["form"]
    ? "form"
    : [GIM] extends ["partial"]
      ? "partial"
      : [GIM] extends ["patch"]
        ? "patch"
        : "strict";

export type InputParams<
  I,
  ICtx extends InputCtx,
  GIM extends InputMode | undefined,
> = [I] extends [void]
  ? void
  : ResolvedMode<GIM, ICtx> extends "strict"
    ? I
    : ResolvedMode<GIM, ICtx> extends "patch"
      ? Partial<I>
      : ResolvedMode<GIM, ICtx> extends "form"
        ? { [K in keyof I]: unknown }
        : Partial<{ [K in keyof I]: unknown }>;

export type QueryResult<T = unknown> = [T, null] | [null, ErrorResponse];
export type MutationResult<T = unknown> =
  | [Prettify<T>, null]
  | [null, ErrorResponse];

export type ContextResult<T> =
  | { ok: true; ctx: T }
  | { ok: false; reason: FailureReason };

export type ErrorResponse = Prettify<
  {
    message: string;
    reason: FailureReason;
    errors?: Record<string, string>;
  } & BaseError
>;

export type FailureReason =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "MAINTENANCE_MODE"
  | "VALIDATION_ERROR"
  | "UNEXPECTED_ERROR"
  | "INVALID_SESSION"
  | "ABORTED"
  | "INVALID_CACHE_KEY"
  | "TIMEOUT"
  | "RETRY_EXHAUSTED"
  | "CIRCUIT_OPEN"
  | "RATE_LIMITED"
  | (string & {});
