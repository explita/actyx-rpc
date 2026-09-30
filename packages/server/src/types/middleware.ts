import type {
  BaseContext,
  ErrorResponse,
  MaybePromise,
  MergeMeta,
  Prettify,
} from "./misc.js";

/**
 * Represents the result returned by a middleware function or `next()` invocation.
 *
 * Can be:
 * - `{ _isNext: true, ctx: NextCtx }`: Instructs the pipeline to continue to the next middleware or handler with updated context.
 * - `Record<string, any>`: An early return / validation failure object that terminates execution and returns an error response.
 * - `void | undefined | null`: Continues execution with the existing context unmodified.
 *
 * @template NextCtx - New or updated context fields yielded by this middleware.
 */
export type MiddlewareResult<NextCtx> =
  | { _isNext: true; ctx: NextCtx }
  | Record<string, any>
  | void
  | undefined
  | null;

/**
 * A middleware function that intercepts procedure execution.
 *
 * Middlewares execute sequentially before the terminal handler runs. They can inspect
 * or modify the request context, examine validated input, perform authentication/authorization checks,
 * run side-effects, or abort execution early by returning an error response or throwing.
 *
 * @template Ctx - The context accumulated prior to this middleware.
 * @template TEnrich - Enriched input properties injected by the builder.
 * @template I - The schema-validated input payload type.
 * @template NextCtx - New or overridden context fields introduced by this middleware.
 * @template TMeta - Metadata record attached to the procedure.
 * @template TName - The name of the procedure.
 *
 * @param opts - Execution options passed to the middleware.
 * @param opts.ctx - Current procedure context merged with metadata.
 * @param opts.input - Merged input object containing both validated input and enriched fields.
 * @param opts.next - Callback function to continue to the downstream middleware or terminal handler with optional context extensions.
 * @param args - Additional positional arguments forwarded to the procedure call.
 *
 * @returns A `MiddlewareResult` or promise of a `MiddlewareResult` indicating continuation or early termination.
 *
 * @example
 * ```ts
 * const authMiddleware: Middleware = async ({ ctx, next }) => {
 *   const user = await verifyToken(ctx.token);
 *   return next({ user });
 * };
 * ```
 */
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

/**
 * A modular lifecycle plugin for procedures.
 *
 * Plugins allow attaching cross-cutting hooks to procedures, including input validation (`validate`),
 * pre-execution middleware (`onBefore`), post-execution side-effects (`onAfter`), and error interception (`onError`).
 *
 * @template Ctx - The context accumulated prior to this plugin.
 * @template TEnrich - Enriched input properties injected by the builder.
 * @template I - The schema-validated input payload type.
 * @template NextCtx - Context fields added or modified by the plugin's `onBefore` middleware.
 * @template TMeta - Metadata record attached to the procedure.
 * @template TName - The name of the procedure.
 *
 * @example
 * ```ts
 * const loggerPlugin: Plugin = {
 *   onBefore: ({ ctx, next }) => {
 *     console.log("Starting execution");
 *     return next();
 *   },
 *   onAfter: (ctx, result) => {
 *     console.log("Completed with:", result);
 *   },
 *   onError: ({ error, ctx }) => {
 *     console.error("Procedure failed:", error);
 *   },
 * };
 * ```
 */
export type Plugin<
  Ctx,
  TEnrich,
  I,
  NextCtx,
  TMeta,
  TName extends string = string,
> = {
  /**
   * Middleware function executed before the terminal handler runs.
   *
   * Can inspect input and context, perform pre-flight checks, and extend context for downstream handlers.
   */
  onBefore?: Middleware<Ctx, TEnrich, I, NextCtx, TMeta, TName>;

  /**
   * Lifecycle hook invoked after the terminal handler completes successfully.
   *
   * Runs asynchronously in the background. Useful for audit logging, metrics emission, or event publishing.
   *
   * @param ctx - The resolved context of the procedure.
   * @param result - The resolved return value of the procedure handler.
   */
  onAfter?: (
    ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>,
    result: unknown,
  ) => Promise<void> | void;

  /**
   * Lifecycle hook invoked when an error occurs during procedure execution.
   *
   * Can log errors to monitoring platforms (e.g. Sentry) or return a partial error response
   * to customize or override the error payload returned to the client.
   *
   * @param params - Object containing the caught error, procedure context, raw input, and arguments.
   * @returns An optional partial error response to override the client error payload, or void.
   */
  onError?: (params: {
    error: unknown;
    ctx: MergeMeta<Ctx, BaseContext<TMeta, TName>>;
    input: unknown;
    args: any;
  }) => MaybePromise<Partial<ErrorResponse> | void>;

  /**
   * Custom validation hook executed against the combined input payload before handler execution.
   *
   * Runs before procedure middlewares. Return `{ success: true, data?: unknown }` to allow execution,
   * or `{ success: false, errors?: Record<string, string> }` to fail with a validation error.
   *
   * @param input - The merged input object (validated input schema + enriched fields).
   * @returns A validation outcome indicating success or validation failure details.
   */
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
