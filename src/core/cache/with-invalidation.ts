import { isErrorResponse } from "../../lib/utils.js";
import type { CacheAdapter, CacheInvalidationOptions } from "./types.js";
import { invalidateCache } from "./invalidate.js";

export function withInvalidation<TInput, TOutput>(
  handler: (
    opts: { ctx: any; input: TInput },
    ...args: any[]
  ) => Promise<TOutput>,
  cache: CacheAdapter,
  options: CacheInvalidationOptions,
): (opts: { ctx: any; input: TInput }, ...args: any[]) => Promise<TOutput> {
  return async (opts, ...args): Promise<TOutput> => {
    // Execute mutation first
    const result = await handler(opts, ...args);

    // Only invalidate if the mutation was successful
    if (!isErrorResponse(result)) {
      await invalidateCache(cache, options, opts);
    }

    return result;
  };
}
