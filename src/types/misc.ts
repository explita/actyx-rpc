export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type BaseError = {
  success: boolean;
  handlerName?: string;
};

export type BaseContext = {
  handlerName?: string;
};

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

export type InputMode = "strict" | "form" | "partial";

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
   * [form] Uses a loose object shape where every declared key is `unknown`.
   *
   * [partial] Uses a partial object shape for patch-style callers.
   *
   * @default "strict"
   */
  mode?: InputMode;
};

type ResolvedMode<
  GIM extends InputMode,
  ICtx extends InputCtx,
> = ICtx["mode"] extends InputMode
  ? ICtx["mode"]
  : GIM extends InputMode
    ? GIM
    : "partial";

export type InputParams<I, ICtx extends InputCtx, GIM extends InputMode> = [
  I,
] extends [void]
  ? void
  : ResolvedMode<GIM, ICtx> extends "strict"
    ? I
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
    statusCode?: number;
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
