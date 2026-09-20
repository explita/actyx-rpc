import type { Redis } from "ioredis";
import {
  BaseContext,
  MaybePromise,
  Prettify,
  WindowTime,
} from "../../types/misc.js";
export type { WindowTime };

/**
 * Adapter interface for caching implementations (e.g., In-Memory, Redis).
 *
 * Provides a unified API for storing, retrieving, checking, and invalidating
 * cached procedure results and custom data.
 */
export type CacheAdapter = {
  /**
   * Retrieves a cached entry by key.
   *
   * @template T - The expected data type of the cached entry
   * @param key - Unique cache key
   * @returns The cached entry wrapping the data and its metadata, or `undefined` if not found/expired
   *
   * @example
   * ```typescript
   * const entry = await cache.get<User>('user:123');
   * if (entry) {
   *   console.log(entry.data.name, entry.isStale);
   * }
   * ```
   */
  get<T>(key: string): MaybePromise<CacheEntry<T> | undefined>;

  /**
   * Stores a value in the cache with optional expiration and stale settings.
   *
   * @template T - The data type being cached
   * @param key - Unique cache key
   * @param data - The payload to store (undefined and null values are ignored)
   * @param options - TTL and stale time configuration (in milliseconds)
   *
   * @example
   * ```typescript
   * await cache.set('user:123', userData, {
   *   ttl: 60_000,       // 1 minute TTL
   *   staleTime: 30_000, // Stale after 30 seconds
   * });
   * ```
   */
  set<T>(
    key: string,
    data: T,
    options?: { ttl?: WindowTime; staleTime?: WindowTime },
  ): Promise<void> | void;

  /**
   * Checks whether a cached entry is considered stale based on its `staleTime`.
   *
   * @param key - Unique cache key
   * @returns `true` if the entry exists and has exceeded its stale duration, `false` otherwise
   */
  isStale(key: string): Promise<boolean> | boolean;

  /**
   * Checks whether a non-expired entry exists in the cache.
   *
   * @param key - Unique cache key
   * @returns `true` if the key exists and has not expired, `false` otherwise
   */
  has(key: string): Promise<boolean> | boolean;

  /**
   * Deletes a specific entry from the cache.
   *
   * @param key - Unique cache key to remove
   * @returns `true` if the key was deleted, `false` if it did not exist
   */
  delete(key: string): Promise<boolean> | boolean;

  /**
   * Clears all entries from the cache adapter.
   */
  clear(): Promise<void> | void;

  /**
   * Clears entries matching a key pattern (e.g. `user:*`).
   * Supported by Redis and memory cache adapters that implement pattern matching.
   *
   * @param pattern - Glob-style pattern to match keys against
   */
  clearByPattern?(pattern: string): Promise<void>;

  /**
   * Associates one or more tags with a cache key for group invalidation.
   *
   * @param key - Cache key to tag
   * @param tags - A single tag string or array of tags
   */
  addTag?(key: string, tags: string | string[]): Promise<void>;

  /**
   * Invalidates all cache entries associated with a specific tag.
   *
   * @param tag - Tag name whose associated entries should be purged
   */
  invalidateByTag?(tag: string): Promise<void>;
};

/**
 * Redis client instance or factory function.
 *
 * Use a factory function when you need lazy initialization or
 * want to avoid circular dependencies.
 *
 * @example
 * ```typescript
 * // Direct instance
 * const redis = new Redis({ host: 'localhost' })
 *
 * // Factory function (lazy initialization)
 * const redis = () => new Redis({ host: 'localhost' })
 * ```
 */
export type RedisInstance = Redis | (() => Redis);

/**
 * Configuration options for creating a Redis cache adapter.
 *
 * @example
 * ```typescript
 * import Redis from 'ioredis';
 * import { RedisCache } from '@explita/actyx-rpc';
 *
 * const redis = new Redis({ host: 'localhost', port: 6379 });
 * const cache = new RedisCache({
 *   redis,
 *   prefix: 'myapp:cache:',
 *   defaultTTL: '5m',
 *   defaultStaleTime: '1m'
 * });
 * ```
 */
export type RedisCacheOptions = {
  /**
   * Prefix for all cache keys in Redis.
   * Helps organize keys and avoid collisions with other applications.
   *
   * @default 'actyx:cache:'
   *
   * @example
   * ```typescript
   * prefix: 'myapp:cache:'  // Results in: myapp:cache:user:123
   * ```
   */
  prefix?: string;

  /**
   * Default Time-To-Live for cached entries.
   * After this time, the entry is automatically removed from Redis.
   *
   * Format: `${number}${"m" | "h" | "d" | "w" | "M"}`
   * - `m` = minutes
   * - `h` = hours
   * - `d` = days
   * - `w` = weeks
   * - `M` = months (30 days)
   *
   * @default '1m' (1 minute)
   *
   * @example
   * ```typescript
   * defaultTTL: '5m'   // 5 minutes
   * defaultTTL: '2h'   // 2 hours
   * defaultTTL: '1d'   // 1 day
   * defaultTTL: '1w'   // 1 week
   * defaultTTL: '1M'   // 1 month
   * ```
   */
  defaultTTL?: WindowTime;

  /**
   * Default stale time for cached entries.
   * After this time, data is considered stale and will be refreshed
   * in the background when `staleWhileRevalidate` is enabled.
   *
   * Set to `0` to never consider data stale.
   *
   * @default 0 (never stale)
   *
   * @example
   * ```typescript
   * defaultStaleTime: '30s'  // Stale after 30 seconds
   * defaultStaleTime: '5m'   // Stale after 5 minutes
   * defaultStaleTime: 0      // Never stale
   * ```
   */
  defaultStaleTime?: WindowTime;

  /**
   * Custom serializer/deserializer for cache values.
   * Use this to implement custom encoding (e.g., MessagePack, CBOR)
   * or to handle special data types like Dates, Buffers, or Classes.
   *
   * @default JSON.stringify / JSON.parse
   *
   * @example
   * ```typescript
   * // Using MessagePack for better performance
   * import { encode, decode } from '@msgpack/msgpack';
   *
   * serializer: {
   *   serialize: (value) => encode(value),
   *   deserialize: (value) => decode(value)
   * }
   * ```
   *
   * @example
   * ```typescript
   * // Custom serialization for Date objects
   * serializer: {
   *   serialize: (value) => JSON.stringify({
   *     ...value,
   *     createdAt: value.createdAt?.toISOString()
   *   }),
   *   deserialize: (value) => {
   *     const parsed = JSON.parse(value);
   *     parsed.createdAt = new Date(parsed.createdAt);
   *     return parsed;
   *   }
   * }
   * ```
   */
  serializer?: {
    /**
     * Serializes a value to a string for storage in Redis.
     * @param value - The value to serialize
     * @returns A string representation of the value
     */
    serialize: (value: any) => string;

    /**
     * Deserializes a string back to its original value.
     * @param value - The string to deserialize
     * @returns The deserialized value
     */
    deserialize: <T>(value: string) => T;
  };
};

export type CacheMetadata = {
  expiresAt: number;
  staleAt: number;
  lastAccessed: number;
  createdAt: number;
  hash: string;
};

export type CacheEntry<T = unknown> = {
  data: T;
  metadata: CacheMetadata;
  isStale: boolean;
};

/**
 * Configuration options for caching behavior.
 * @template Ctx - The context type (includes enriched input)
 * @template I - The input type
 */
export type CacheOptions<Ctx = unknown, I = unknown> = {
  /**
   * Time to live in milliseconds.
   * After this time, the cached entry will be removed.
   * @default 1m (1 minute)
   */
  ttl?: WindowTime;

  /**
   * Time in milliseconds until data becomes stale.
   * Stale data can still be returned while being refreshed in the background
   * when `staleWhileRevalidate` is enabled.
   * @default 0 (never stale)
   */
  staleTime?: WindowTime;

  /**
   * Maximum number of entries in the cache.
   * When exceeded, the least recently used entry is evicted.
   * Only applies to in-memory cache implementations.
   * @default 100
   */
  maxSize?: number;

  /**
   * Tags for group invalidation.
   * All cached entries with matching tags can be invalidated together.
   * @example
   * tags: ['users', 'active-users']
   */
  tags?: (opts: { ctx: Ctx; input: I }) => MaybePromise<string[]> | string[];

  /**
   * Whether to decompress cached data.
   * Enable this when storing compressed data to automatically decompress on cache hit.
   * @default false
   */
  decompress?: boolean;

  /**
   * Custom cache key generator function.
   * Use this to create predictable, human-readable cache keys.
   * @param opts - Object containing context and input
   * @returns A string key for the cache entry
   * @example
   * key: ({ ctx, input }) => `user:${ctx.tenantId}:${input.id}`
   */
  key?: (opts: { ctx: Ctx; input: I }) => MaybePromise<string>;

  /**
   * Callback triggered when an entry is evicted from cache.
   * Useful for cleanup or logging.
   * @param key - The cache key being evicted
   * @param entry - The cached entry being removed
   */
  onEvict?: <T = unknown>(key: string, entry: CacheEntry<T>) => void;

  /**
   * Callback triggered when a cache hit occurs.
   * @param key - The cache key that was hit
   * @param entry - The cached entry retrieved
   */
  onHit?: <T = unknown>(key: string, entry: CacheEntry<T>) => void;

  /**
   * Callback triggered when a cache miss occurs.
   * @param key - The cache key that was not found
   */
  onMiss?: (key: string) => void;
};

export interface WithCacheOptions<
  C = unknown,
  I = unknown,
> extends CacheOptions<C, I> {
  staleWhileRevalidate?: boolean; // Return stale data while revalidating
}

export type CacheConfig = {
  enabled: boolean;
  options?: WithCacheOptions;
};

export type CacheInvalidateKeyFn<Ctx = unknown, I = unknown> =
  | ((opts: { ctx: Ctx; input: I }) => MaybePromise<string | string[]>)
  | string
  | string[];

export interface CacheInvalidationOptions<Ctx = unknown, I = unknown> {
  /** Keys or patterns to invalidate */
  keys?: CacheInvalidateKeyFn<Ctx, I>;
  /** Patterns to match (supports * wildcard) */
  patterns?: CacheInvalidateKeyFn<Ctx, I>;

  /** Tags to invalidate (if using tag-based caching) */
  tags?: CacheInvalidateKeyFn<Ctx, I>;
  /** Delay invalidation in ms (useful for race conditions) */
  delay?: number;
}

export type CacheInvalidationConfig = {
  enabled: boolean;
  options?: CacheInvalidationOptions;
};

/**
 * Context-aware cache helper attached to `ctx.cache`.
 * Combines all standard CacheAdapter methods with typed invalidation.
 */
export type CacheContextHelper<
  TCtx = unknown,
  TInput = unknown,
> = CacheAdapter & {
  /**
   * Invalidates cache from inside a terminal handler.
   * Same options as the `.invalidate()` builder method.
   */
  invalidate: (
    options: CacheInvalidationOptions<TCtx, TInput>,
  ) => Promise<void>;
};

export type RateLimitOptions<
  Ctx = unknown,
  I = unknown,
  TMeta = unknown,
  TName extends string = string,
> = {
  /** Number of requests allowed (default: 100) */
  limit?: number;
  /** Time window (e.g., "1m", "5m", "1h", "1d", "1w", "1M") */
  window?: WindowTime;
  /** Custom key generator (default: based on ctx) */
  key?: (
    opts: {
      ctx: Prettify<Ctx & BaseContext<TMeta, TName>>;
      input: I;
    },
    req: Request,
    context: any,
  ) => MaybePromise<string>;
  /** Response message when rate limited (default: "Too many requests") */
  message?: string;
  /** Callback when rate limited */
  onRateLimited?: (
    key: string,
    limit: number,
    windowMs: number,
    req: Request,
    context: any,
  ) => void;
};

export type RateLimitConfig = {
  enabled: boolean;
  options?: RateLimitOptions;
};
