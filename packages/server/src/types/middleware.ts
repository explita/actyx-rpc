import type {
  BaseContext,
  ErrorResponse,
  MaybePromise,
  MergeMeta,
  Prettify,
} from "./misc.js";

export type MiddlewareResult<NextCtx> =
  | { _isNext: true; ctx: NextCtx }
  | Record<string, any>
  | void
  | undefined
  | null;

// Context mutating middlewares
export type Middleware<
  Ctx,
  TEnrich,
  I,
  NextCtx,
  TMeta,
  TName extends string = string,
> = (
  opts: {
    ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
    input: Prettify<I & TEnrich>;
    next: <NewCtx extends Record<string, unknown>>(
      ctx?: NewCtx,
    ) => MiddlewareResult<MergeMeta<Ctx, NewCtx>>;
  },
  ...args: any[]
) => MaybePromise<MiddlewareResult<MergeMeta<Ctx, NextCtx>>>;

export type Plugin<
  Ctx,
  TEnrich,
  I,
  NextCtx,
  TMeta,
  TName extends string = string,
> = {
  onBefore?: Middleware<Ctx, TEnrich, I, NextCtx, TMeta, TName>;
  onAfter?: (
    ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>,
    result: unknown,
  ) => Promise<void> | void;
  onError?: (params: {
    error: unknown;
    ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
    input: unknown;
    args: any;
  }) => MaybePromise<Partial<ErrorResponse> | void>;
  validate?: (
    input: Prettify<I & TEnrich>,
  ) =>
    | Promise<
        | { success: true; data?: unknown }
        | { success: false; errors?: Record<string, string> }
      >
    | { success: true; data?: unknown }
    | { success: false; errors?: Record<string, string> };
};
