import { type Middleware } from "../../types/middleware.js";
import type { ErrorResponse } from "../../types/misc.js";

export async function runMiddlewares(
  middlewares: Middleware<any, any, any, any, any>[],
  ctx: any,
  input: any,
  next: any,
  args: any[],
  baseError: Partial<ErrorResponse>,
): Promise<{ ctx: any; shouldContinue: boolean; errorResponse?: any }> {
  let currentCtx = ctx;

  for (const mw of middlewares) {
    const mwResult = await mw({ ctx: currentCtx, input, next }, ...args);

    if (mwResult && typeof mwResult === "object" && "_isNext" in mwResult) {
      // Continue to next middleware
      currentCtx = { ...currentCtx, ...mwResult.ctx };
    } else if (mwResult && typeof mwResult === "object") {
      // Early return or error from middleware
      const parsed = parseMiddlewareResponse(
        mwResult as Record<string, unknown>,
      );

      return {
        ctx: currentCtx,
        shouldContinue: false,
        errorResponse: {
          ...baseError,
          message: parsed.message || "Validation failed",
          reason: parsed.reason || "VALIDATION_ERROR",
          statusCode: Number(parsed.statusCode) || 400,
          errors: mwResult,
          ...parsed,
        },
      };
    }
  }

  return { ctx: currentCtx, shouldContinue: true };
}

function parseMiddlewareResponse(data: Record<string, unknown>) {
  //all keys starting with _ should be elevated to top level
  const result: Record<string, unknown> = {};
  for (const key in data) {
    if (key.startsWith("_")) {
      result[key.slice(1)] = data[key];
    } else {
      result[key] = data[key];
    }
  }
  return result;
}
