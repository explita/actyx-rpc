import {
  getFinalStatusCode,
  isErrorResponse,
  normalizeInput,
} from "../../lib/utils.js";
import type { Middleware } from "../../types/middleware.js";
import type { ProcedureConfig, ProcedureProps } from "../../types/procedure.js";
import { checkRateLimit } from "../cache/rate-limit.js";
import type { CacheAdapter } from "../cache/types.js";
import { startSpan, recordError } from "../telemetry/tracer.js";
import { runMiddlewares } from "./run-middlewares.js";

export function handlerResolver<O, P = any>(
  handler: (opts: { ctx: any; input: any }, ...args: P[]) => Promise<O>,
  opts: ProcedureProps<any, any, any>,
  config: ProcedureConfig<any, any> = {},
  cache: CacheAdapter,
) {
  return async (payload?: Record<string, unknown> | FormData, ...args: P[]) => {
    const start = performance.now();
    let input: unknown = payload;
    let rootCtx: Awaited<ReturnType<typeof opts.createContext>> | null = null;

    let span: any = null;
    if (config.telemetry) {
      span = startSpan(`RPC ${config.name || "unnamed"}`, {
        "rpc.method": config.name,
      });
    }

    const baseError = {
      success: false,
      handlerName: config.name ?? "",
    };

    const baseCtx = {
      handlerName: config.name ?? "",
      meta: { ...(opts.meta ?? {}), ...(config.meta ?? {}) },
    };

    try {
      rootCtx = await opts.createContext(baseCtx);

      if (!rootCtx.ok) {
        const customError = await opts.onContextError?.({
          reason: rootCtx.reason,
          ctx: { ...baseCtx, ...rootCtx },
        });

        if (customError) {
          return [null, customError];
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

      let currentCtx: any = {
        ...baseCtx,
        ...rootCtx.ctx,
      };

      if (config.rateLimit?.enabled) {
        const result = await checkRateLimit(
          cache,
          config.rateLimit.options!,
          currentCtx,
        );

        if (!result.allowed) return [null, { ...baseError, ...result.error }]; // Rate limited
      }

      if (config.resolver && payload) {
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
      } else if (payload === undefined) {
        input = {};
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
      ] as Middleware<any, any, any, any>[];

      const mwResult = await runMiddlewares(
        allMiddlewares,
        { ...currentCtx },
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

      const result = await handler(
        { ctx: currentCtx, input: enrichedData },
        ...args,
      );

      // Run plugin.onAfter() hooks
      for (const plugin of config.plugins ?? []) {
        Promise.resolve(plugin.onAfter?.({ ...currentCtx }, result)).catch(
          (err) => console.error(err),
        );
      }

      const isError = isErrorResponse(result);

      if (isError) {
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
                ...baseError,
                ...onErrorRes,
              },
            ];
          }
        }
        // Run plugin.onError() hooks
        for (const plugin of config.plugins ?? []) {
          Promise.resolve(
            plugin.onError?.({
              error: result,
              ctx: { ...currentCtx },
              input: enrichedData,
              args,
            }),
          ).catch((err) => console.error(err));
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
          ctx: { ...currentCtx },
          input: enrichedData,
          output: result,
          duration: end - start,
          args,
        }),
      ).catch((err) => console.error(err));

      return [result, null];
    } catch (error: any) {
      // Run plugin.onError() hooks
      for (const plugin of config.plugins ?? []) {
        Promise.resolve(
          plugin.onError?.({
            error,
            //@ts-ignore
            ctx: { ...baseCtx, ...rootCtx?.ctx },
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
          return [null, onErrorRes];
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
          message: error.message ?? "An unexpected error occurred",
          reason: error.reason ?? "UNEXPECTED_ERROR",
          statusCode: getFinalStatusCode(error.statusCode),
        },
      ];
    }
  };
}
