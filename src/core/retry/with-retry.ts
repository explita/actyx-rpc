import { calculateDelay } from "../../lib/retry-backoff.js";
import { isErrorResponse } from "../../lib/utils.js";
import type { ErrorResponse } from "../../types/misc.js";
import type { RetryOptions } from "./types.js";

export function withRetry<TInput, TOutput>(
  handler: (
    opts: { ctx: any; input: TInput },
    ...args: any[]
  ) => Promise<TOutput>,
  options: RetryOptions = {},
): (opts: { ctx: any; input: TInput }, ...args: any[]) => Promise<TOutput> {
  const attempts = options.attempts ?? 3;
  const backoff = options.backoff ?? "exponential";
  const initialDelay = options.initialDelay ?? 100;
  const maxDelay = options.maxDelay ?? 10000;
  const factor = options.factor ?? 2;
  const retryIf = options.if ?? (() => true);
  const onRetry = options.onRetry;
  const onFailed = options.onFailed;

  const backoffOptions = { backoff, initialDelay, maxDelay, factor };

  return async (opts, ...args): Promise<TOutput> => {
    let lastError: ErrorResponse | unknown;

    for (let attempt = 0; attempt <= attempts; attempt++) {
      try {
        const result = await handler(opts, ...args);

        // Check if result is an error response object
        if (isErrorResponse(result)) {
          const errorResponse = result as ErrorResponse;
          lastError = errorResponse;

          const shouldRetry = attempt < attempts && retryIf(errorResponse);

          if (!shouldRetry) {
            onFailed?.(errorResponse, attempt);
            throw {
              ...errorResponse,
              reason: "RETRY_EXHAUSTED",
            }; // Let resolver handle normalization
          }

          const delay = calculateDelay(attempt, backoffOptions);
          onRetry?.(errorResponse, attempt + 1, delay);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }

        // Success - return result
        return result;
      } catch (err) {
        lastError = err;

        const shouldRetry = attempt < attempts && retryIf(err as ErrorResponse);

        if (!shouldRetry) {
          onFailed?.(err as ErrorResponse, attempt);
          // Attach reason to the error object if possible, or wrap it
          if (err instanceof Error) {
            (err as any).reason = "RETRY_EXHAUSTED";
          }
          throw err;
        }

        const delay = calculateDelay(attempt, backoffOptions);
        onRetry?.(err as ErrorResponse, attempt + 1, delay);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    throw lastError;
  };
}
