import { CacheKeyException } from "../../lib/error.js";
import { isErrorResponse, parseWindow, toBuffer } from "../../lib/utils.js";
import { Compressor } from "../compression/compressor.js";
import type { CacheAdapter, WithCacheOptionsInput } from "./types.js";

export function withCache<TInput, TOutput>(
  handler: (
    opts: { ctx: any; input: TInput },
    ...args: any[]
  ) => Promise<TOutput>,
  cache: CacheAdapter, // ← Works with any CacheAdapter
  optionsInput: WithCacheOptionsInput<any, TInput>,
): (opts: { ctx: any; input: TInput }, ...args: any[]) => Promise<TOutput> {
  return async (
    opts: { ctx: any; input: TInput },
    ...args: any[]
  ): Promise<TOutput> => {
    const options =
      typeof optionsInput === "function"
        ? await optionsInput(opts, ...args)
        : optionsInput;

    // Allow dynamic cache factories to bypass caching by returning null/undefined
    if (!options) {
      return handler(opts, ...args);
    }

    const getCacheKey = options.key;
    const ttlValue = options?.ttl;
    const ttl = ttlValue ? parseWindow(ttlValue) : undefined;

    const staleTimeValue = options?.staleTime ?? "0m";
    const staleTime =
      typeof staleTimeValue === "number"
        ? staleTimeValue
        : parseWindow(staleTimeValue);
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

    const cacheKey = await getCacheKey(opts, ...args);

    if (!cacheKey) {
      throw new CacheKeyException("Cache key cannot be empty", {
        reason: "EMPTY_CACHE_KEY",
        statusCode: 400,
      });
    }

    // These now work with any adapter (sync or async)
    const cached = await cache.get<TOutput>(cacheKey);

    if (cached !== undefined && !cached.isStale) {
      options?.onHit?.(cacheKey, {
        data: cached.data,
        metadata: cached.metadata,
        isStale: cached.isStale,
      });
      return decompress(cached.data);
    }

    const persistFresh = async (fresh: TOutput) => {
      if (!isErrorResponse(fresh)) {
        await cache.set(cacheKey, fresh, { ttl, staleTime });
        if (options?.tags) {
          const tags =
            typeof options.tags === "function"
              ? await options.tags(opts, ...args)
              : options.tags;
          await cache.addTag?.(cacheKey, tags);
        }
      }
    };

    if (staleWhileRevalidate && cached !== undefined && cached.isStale) {
      options?.onHit?.(cacheKey, {
        data: cached.data,
        metadata: cached.metadata,
        isStale: cached.isStale,
      });

      (async () => {
        try {
          const fresh = await handler(opts, ...args);
          await persistFresh(fresh);
          options?.onMiss?.(cacheKey);
        } catch {
          // Silently fail
        }
      })();

      return decompress(cached.data);
    }

    options?.onMiss?.(cacheKey);
    const fresh = await handler(opts, ...args);
    await persistFresh(fresh);

    return fresh;
  };
}
