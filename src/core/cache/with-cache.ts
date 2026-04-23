import { CacheKeyException } from "../../lib/error.js";
import {
  hashKey,
  isErrorResponse,
  parseWindow,
  toBuffer,
} from "../../lib/utils.js";
import { Compressor } from "../compression/compressor.js";
import type { CacheAdapter, WithCacheOptions } from "./types.js";

export function withCache<TInput, TOutput>(
  handler: (
    opts: { ctx: any; input: TInput },
    ...args: any[]
  ) => Promise<TOutput>,
  cache: CacheAdapter, // ← Works with any CacheAdapter
  options?: WithCacheOptions<any, TInput>,
): (opts: { ctx: any; input: TInput }, ...args: any[]) => Promise<TOutput> {
  const getCacheKey =
    options?.key ??
    ((opts: { ctx: any; input: TInput }) => JSON.stringify(opts));
  const ttlValue = options?.ttl;
  const ttl = typeof ttlValue === "number" ? ttlValue : ttlValue ? parseWindow(ttlValue) : undefined;
  
  const staleTimeValue = options?.staleTime ?? "0m";
  const staleTime = typeof staleTimeValue === "number" ? staleTimeValue : parseWindow(staleTimeValue);
  const staleWhileRevalidate = options?.staleWhileRevalidate ?? false;

  async function decompress(data: TOutput): Promise<TOutput> {
    if (options?.decompress) {
      // Check if data is a serialized buffer from Redis
      const bufferData = toBuffer(data);

      if (Buffer.isBuffer(bufferData)) {
        const compressor = new Compressor();
        const decompressed = await compressor.decompress(bufferData);
        return decompressed as TOutput;
      }
    }
    return data;
  }

  return async (
    opts: { ctx: any; input: TInput },
    ...args: any[]
  ): Promise<TOutput> => {
    let cacheKey = getCacheKey(opts);

    if (!cacheKey) {
      throw new CacheKeyException("Cache key cannot be empty", {
        reason: "EMPTY_CACHE_KEY",
        statusCode: 400,
      });
    }
    cacheKey = hashKey(cacheKey);

    // These now work with any adapter (sync or async)
    const cached = await cache.get<TOutput>(cacheKey);

    if (cached !== undefined && !cached.isStale) {
      options?.onHit?.(cacheKey, { data: cached.data } as any);
      return decompress(cached.data);
    }

    if (staleWhileRevalidate && cached !== undefined && cached.isStale) {
      options?.onHit?.(cacheKey, { data: cached.data } as any);

      (async () => {
        try {
          const fresh = await handler(opts, ...args);
          if (!isErrorResponse(fresh)) {
            await cache.set(cacheKey, fresh, { ttl, staleTime });
            if (options?.tags) {
              await cache.addTag?.(cacheKey, options.tags);
            }
          }
          options?.onMiss?.(cacheKey);
        } catch (e) {
          // Silently fail
        }
      })();

      return decompress(cached.data);
    }

    options?.onMiss?.(cacheKey);
    const fresh = await handler(opts, ...args);

    if (!isErrorResponse(fresh)) {
      await cache.set(cacheKey, fresh, { ttl, staleTime });
      if (options?.tags) {
        await cache.addTag?.(cacheKey, options.tags);
      }
    }

    return fresh;
  };
}
