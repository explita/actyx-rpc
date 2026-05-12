import { AsyncLocalStorage } from "node:async_hooks";
import {
  getFinalStatusCode,
  isErrorResponse,
  normalizeInput,
} from "../../lib/utils.js";
import { type Middleware } from "../../types/middleware.js";
import type { ProcedureConfig, ProcedureProps } from "../../types/procedure.js";
import { checkRateLimit } from "../cache/rate-limit.js";
import type { CacheAdapter } from "../cache/types.js";
import { startSpan, recordError } from "../telemetry/tracer.js";
import { runMiddlewares } from "./run-middlewares.js";
import { PubSubAdapter } from "../../lib/pubsub.js";

/**
 * Global storage to track the current RPC context across nested calls.
 * This enables automatic bypass of context creation.
 */
const rpcStorage = new AsyncLocalStorage<any>();

export function handlerResolver<O, P = any>(
  handler: (opts: { ctx: any; input: any }, ...args: P[]) => Promise<O>,
  opts: ProcedureProps<any, any, any>,
  config: ProcedureConfig<any, any>,
  cache: CacheAdapter,
  pubsub: PubSubAdapter,
) {
  return async function (
    this: any,
    payload?: Record<string, unknown> | FormData,
    ...args: P[]
  ) {
    const caller = (config as any).caller || (this as any)?._def?.caller;
    if (caller) {
      return caller(payload, ...args);
    }

    const start = performance.now();
    let input: unknown = payload;
    let rootCtx: Awaited<ReturnType<typeof opts.createContext>> | null = null;

    let span: any = null;
    if (config.telemetry) {
      span = startSpan(`RPC ${config.name}`, {
        "rpc.method": config.name,
      });
    }

    const baseError = {
      success: false,
      handlerName: config.name,
    };

    const baseCtx = {
      handlerName: config.name,
      meta: { ...(opts.meta ?? {}), ...(config.meta ?? {}) },
    };

    let currentCtx: any = baseCtx;

    try {
      // 1. Context Creation Bypass
      // We reuse existing context from AsyncLocalStorage if available
      const existingCtx = (this as any)?.ctx || rpcStorage.getStore();

      if (existingCtx) {
        rootCtx = { ok: true, ctx: existingCtx };
      } else {
        rootCtx = await opts.createContext(baseCtx);
      }

      if (!rootCtx.ok) {
        const customError = await opts.onContextError?.({
          reason: rootCtx.reason,
          ctx: { ...baseCtx, ...rootCtx },
        });

        if (customError) {
          return [null, { statusCode: 401, ...customError }];
        }

        return [
          null,
          {
            ...baseError,
            message: "Unauthorized",
            reason: rootCtx.reason,
            statusCode: 401,
          },
        ];
      }

      currentCtx = {
        ...baseCtx,
        ...rootCtx.ctx,
      };

      currentCtx.pubsub = pubsub;

      // 2. Authorize (Runs even on bypass to ensure permission integrity)
      if (config.authorize) {
        const authResult = await config.authorize(currentCtx);
        if (
          authResult === false ||
          (typeof authResult === "object" && authResult.success === false)
        ) {
          return [
            null,
            {
              ...baseError,
              message: "Forbidden",
              reason: "FORBIDDEN",
              statusCode: 403,
              ...(typeof authResult === "object" ? authResult : {}),
            },
          ];
        }
      }

      // 3. Rate Limit (Runs even on bypass)
      if (config.rateLimit?.enabled) {
        const result = await checkRateLimit(
          cache,
          config.rateLimit.options!,
          currentCtx,
        );

        if (!result.allowed) return [null, { ...baseError, ...result.error }];
      }

      let isMock = config.mock && process.env.ACTYX_MOCK === "true";

      // 4. Validation
      if (config.resolver && !isMock) {
        const rawData = normalizeInput(payload);
        const result = await config.resolver.parse(rawData);
        if (!result.success)
          return [
            null,
            {
              ...baseError,
              message: "Invalid data provided",
              reason: "VALIDATION_ERROR",
              statusCode: 400,
              ...result,
            },
          ];

        input = result.data;
      } else {
        input = {};
        if (payload !== undefined && payload !== null) {
          args = [payload as any, ...args];
        }
      }

      const enrichment =
        (await opts.enrichInput?.({ ...rootCtx.ctx, meta: baseCtx.meta })) ??
        {};
      let enrichedData = {
        ...enrichment,
        ...(typeof input === "object" && input !== null ? input : {}),
      };

      // Run plugin.validate() hooks
      for (const plugin of config.plugins ?? []) {
        if (plugin.validate) {
          const vResult = await plugin.validate(enrichedData);
          if (!vResult.success) {
            return [
              null,
              {
                ...baseError,
                //@ts-ignore
                message: vResult._message ?? "Validation Error",
                ...vResult,
                reason: "VALIDATION_ERROR",
                statusCode: 400,
              },
            ];
          } else if (
            vResult.data &&
            typeof vResult.data === "object" &&
            !Array.isArray(vResult.data)
          ) {
            enrichedData = {
              ...enrichedData,
              ...vResult.data,
            };
          }
        }
      }

      const next = (newCtx?: any) => ({
        _isNext: true,
        ctx: newCtx ?? currentCtx,
      });

      // Run combined middlewares
      const allMiddlewares = [
        ...(config.middlewares ?? []),
        ...(config.plugins ?? []).map((p) => p.onBefore).filter(Boolean),
      ] as Middleware<any, any, any, any, any>[];

      const mwResult = await runMiddlewares(
        allMiddlewares,
        currentCtx,
        enrichedData,
        next,
        args,
        baseError,
      );

      if (!mwResult.shouldContinue) {
        return [null, mwResult.errorResponse];
      } else {
        currentCtx = mwResult.ctx;
      }

      // Execute handler within the AsyncLocalStorage context
      const result = await rpcStorage.run(currentCtx, async () => {
        return config.mock && process.env.ACTYX_MOCK === "true"
          ? await config.mock({ ctx: currentCtx, input: enrichedData })
          : await handler({ ctx: currentCtx, input: enrichedData }, ...args);
      });

      // Run plugin.onAfter() hooks
      for (const plugin of config.plugins ?? []) {
        Promise.resolve(plugin.onAfter?.(currentCtx, result)).catch((err) =>
          console.error(err),
        );
      }

      const isError = isErrorResponse(result);

      if (isError) {
        // Run plugin.onError() hooks
        for (const plugin of config.plugins ?? []) {
          Promise.resolve(
            plugin.onError?.({
              error: result,
              ctx: currentCtx,
              input: enrichedData,
              args,
            }),
          ).catch((err) => console.error(err));
        }
        if (opts.onError) {
          const onErrorRes = await opts.onError({
            error: result,
            ctx: { ...currentCtx },
            input: enrichedData,
            args,
          });
          if (onErrorRes && typeof onErrorRes === "object") {
            return [
              null,
              {
                reason: "UNEXPECTED_ERROR",
                statusCode: 500,
                ...baseError,
                ...onErrorRes,
              },
            ];
          }
        }
        return [null, result];
      }

      if (span) {
        span.setAttribute("rpc.success", true);
        span.end();
      }

      const end = performance.now();

      Promise.resolve(
        opts.onSuccess?.({
          ctx: { ...baseCtx, ...currentCtx },
          input: enrichedData,
          output: result,
          duration: end - start,
          args,
        }),
      ).catch((err) => console.error(err));

      // 10. Validate Output
      if (config.outputResolver && !isMock) {
        const outputResult = await config.outputResolver.parse(
          result as Record<string, unknown>,
        );

        if (!outputResult.success) {
          return [
            null,
            {
              ...baseError,
              message: "Output validation failed",
              reason: "UNEXPECTED_ERROR",
              statusCode: 500,
              errors: outputResult.errors,
            },
          ];
        }
        return [outputResult.data as any, null];
      }

      return [result as any, null];
    } catch (error: any) {
      // Run plugin.onError() hooks
      for (const plugin of config.plugins ?? []) {
        Promise.resolve(
          plugin.onError?.({
            error,
            ctx: currentCtx,
            input,
            args,
          }),
        ).catch((err) => console.error(err));
      }

      if (span) {
        recordError(span, error);
        span.end();
      }

      if (opts.onError) {
        const onErrorRes = await opts.onError({
          error,
          //@ts-ignore
          ctx: { ...baseCtx, ...rootCtx?.ctx },
          input,
          args,
        });
        if (onErrorRes && typeof onErrorRes === "object") {
          return [
            null,
            {
              statusCode: getFinalStatusCode(error),
              ...baseError,
              ...onErrorRes,
            },
          ];
        }
      } else {
        if (process.env.NODE_ENV === "development") {
          console.error(`[Procedure Error (${baseError.handlerName})]:`, error);
        }
      }
      return [
        null,
        {
          ...baseError,
          message:
            error?.message ??
            (typeof error === "string"
              ? error
              : "An unexpected error occurred"),
          reason: error?.reason ?? "UNEXPECTED_ERROR",
          statusCode: getFinalStatusCode(error),
          ...(typeof error === "object" && error !== null ? error : {}),
        },
      ];
    }
  };
}
