import { isErrorResponse } from "../../lib/utils.js";
import type {
  CacheAdapter,
  CacheInvalidateKeyFn,
  CacheInvalidationOptions,
} from "./types.js";

export function withInvalidation<TInput, TOutput>(
  handler: (
    opts: { ctx: any; input: TInput },
    ...args: any[]
  ) => Promise<TOutput>,
  cache: CacheAdapter,
  options: CacheInvalidationOptions,
): (opts: { ctx: any; input: TInput }, ...args: any[]) => Promise<TOutput> {
  const delay = options.delay ?? 0;

  const evaluateInvalidationItem = (
    item: CacheInvalidateKeyFn,
    opts: { ctx: any; input: TInput },
  ): string[] => {
    if (typeof item === "function") {
      const result = item(opts);
      return Array.isArray(result) ? result : [result];
    }
    return Array.isArray(item) ? item : [item];
  };

  return async (opts, ...args): Promise<TOutput> => {
    // Execute mutation first
    const result = await handler(opts, ...args);

    // Only invalidate if the mutation was successful
    if (!isErrorResponse(result)) {
      // Evaluate all invalidation items with current context and input
      const keysToInvalidate = options.keys
        ? evaluateInvalidationItem(options.keys, opts)
        : [];

      const patternsToInvalidate = options.patterns
        ? evaluateInvalidationItem(options.patterns, opts)
        : [];

      const tagsToInvalidate = options.tags
        ? evaluateInvalidationItem(options.tags, opts)
        : [];

      const invalidate = async () => {
        // Invalidate by exact keys
        for (const key of keysToInvalidate) {
          await cache.delete(key);
        }

        // Invalidate by patterns (if supported)
        if (typeof (cache as any).clearByPattern === "function") {
          for (const pattern of patternsToInvalidate) {
            await (cache as any).clearByPattern(pattern);
          }
        }

        // Invalidate by tags
        for (const tag of tagsToInvalidate) {
          await cache.invalidateByTag?.(tag);
        }
      };

      if (delay > 0) {
        setTimeout(invalidate, delay);
      } else {
        await invalidate();
      }
    }

    return result;
  };
}
