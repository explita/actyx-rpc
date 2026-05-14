import { DEFAULT_TIMEOUT } from "../../lib/constants.js";
import type { ErrorResponse } from "../../types/misc.js";
import type { TimeoutOptions } from "./types.js";

export function withTimeout<TInput, TOutput>(
  handler: (
    opts: { ctx: any; input: TInput },
    ...args: unknown[]
  ) => Promise<TOutput>,
  options: TimeoutOptions = {},
): (opts: { ctx: any; input: TInput }, ...args: unknown[]) => Promise<TOutput> {
  const timeoutMs = options.ms ?? DEFAULT_TIMEOUT;
  const message = options.message ?? `Request timeout after ${timeoutMs}ms`;
  const reason = options.reason ?? "TIMEOUT";
  const onTimeout = options.onTimeout;

  return async (opts, ...args): Promise<TOutput> => {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        onTimeout?.(timeoutMs);

        const error: ErrorResponse = {
          success: false,
          message,
          reason,
          statusCode: 504,
          handlerName: opts.ctx?.handlerName ?? "timeout",
        };

        reject(error);
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([
        handler(opts, ...args),
        timeoutPromise,
      ]);

      //@ts-ignore
      clearTimeout(timeoutId);

      return result;
    } catch (error) {
      //@ts-ignore
      clearTimeout(timeoutId);
      throw error;
    }
  };
}
