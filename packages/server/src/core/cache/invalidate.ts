import type {
  CacheAdapter,
  CacheInvalidateKeyFn,
  CacheInvalidationOptions,
} from "./types.js";

/** The `{ ctx, input }` pair used to evaluate invalidation key/pattern/tag fns. */
export type InvalidationContext = {
  ctx: unknown;
  input: unknown;
};

async function evaluateInvalidationItem(
  item: CacheInvalidateKeyFn,
  opts: InvalidationContext,
  ...args: any[]
): Promise<string[]> {
  if (typeof item === "function") {
    const result = await item(opts, ...args);
    return Array.isArray(result) ? result : [result];
  }
  return Array.isArray(item) ? item : [item];
}

/**
 * Evaluates the `keys`/`patterns`/`tags` of `options` against `opts`
 * (`{ ctx, input }`) and optional positional `...args`, and performs the
 * cache invalidation, honoring `options.delay`.
 *
 * Shared by `withInvalidation()` (the builder's `.invalidate()`) and
 * `ctx.cache.invalidate` inside terminal handlers.
 */
export async function invalidateCache(
  cache: CacheAdapter,
  options: CacheInvalidationOptions,
  opts: InvalidationContext,
  ...args: any[]
): Promise<void> {
  const delay = options.delay ?? 0;

  const keys = options.keys
    ? await evaluateInvalidationItem(options.keys, opts, ...args)
    : [];
  const patterns = options.patterns
    ? await evaluateInvalidationItem(options.patterns, opts, ...args)
    : [];
  const tags = options.tags
    ? await evaluateInvalidationItem(options.tags, opts, ...args)
    : [];

  const invalidate = async () => {
    // Invalidate by exact keys
    for (const key of keys) {
      await cache.delete(key);
    }

    // Invalidate by patterns (if supported)
    if (typeof (cache as any).clearByPattern === "function") {
      for (const pattern of patterns) {
        await (cache as any).clearByPattern(pattern);
      }
    }

    // Invalidate by tags
    for (const tag of tags) {
      await cache.invalidateByTag?.(tag);
    }
  };

  if (delay > 0) {
    setTimeout(invalidate, delay);
  } else {
    await invalidate();
  }
}
