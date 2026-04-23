import type { BaseContext, Prettify } from "./misc.js";

type MiddlewareResult<NextCtx> = {
  _isNext: true;
  ctx: NextCtx;
};

// Context mutating middlewares
export type Middleware<Ctx, TEnrich, I, NextCtx> = (
  opts: {
    ctx: Prettify<Ctx & BaseContext>;
    input: Prettify<I & TEnrich>;
    next: <NewCtx extends Record<string, unknown> = {}>(
      ctx?: NewCtx,
    ) => MiddlewareResult<Prettify<Ctx & NewCtx>>;
  },
  ...args: any[]
) =>
  | Promise<
      | MiddlewareResult<NextCtx>
      | Record<string, string>
      | void
      | undefined
      | null
    >
  | MiddlewareResult<NextCtx>
  | Record<string, string>
  | void
  | undefined
  | null;

export type Plugin<Ctx, TEnrich, I, NextCtx> = {
  onBefore?: Middleware<Ctx, TEnrich, I, NextCtx>;
  onAfter?: (
    ctx: Prettify<Ctx & BaseContext>,
    result: unknown,
  ) => Promise<void> | void;
  onError?: (params: {
    error: unknown;
    ctx: Prettify<Ctx & BaseContext>;
    input: unknown;
    args: any;
  }) => Promise<void> | void;
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
