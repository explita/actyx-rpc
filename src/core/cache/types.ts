import type { Redis } from "ioredis";

export type WindowTime = `${number}${"m" | "h" | "d" | "w" | "M"}` | number;

export type CacheAdapter = {
  get<T>(
    key: string,
  ): Promise<CacheEntry<T> | undefined> | CacheEntry<T> | undefined;
  set<T>(
    key: string,
    data: T,
    options?: { ttl?: number; staleTime?: number },
  ): Promise<void> | void;
  isStale(key: string): Promise<boolean> | boolean;
  has(key: string): Promise<boolean> | boolean;
  delete(key: string): Promise<boolean> | boolean;
  clear(): Promise<void> | void;
  clearByPattern?(pattern: string): Promise<void>;
  addTag?(key: string, tags: string | string[]): Promise<void>;
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
  tags?: string[];

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
  key?: (opts: { ctx: Ctx; input: I }) => string;

  /**
   * Callback triggered when an entry is evicted from cache.
   * Useful for cleanup or logging.
   * @param key - The cache key being evicted
   * @param entry - The cached entry being removed
   */
  onEvict?: (key: string, entry: CacheEntry) => void;

  /**
   * Callback triggered when a cache hit occurs.
   * @param key - The cache key that was hit
   * @param entry - The cached entry retrieved
   */
  onHit?: (key: string, entry: CacheEntry) => void;

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
  | ((opts: { ctx: Ctx; input: I }) => string | string[])
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

export type RateLimitOptions<Ctx = unknown> = {
  /** Number of requests allowed (default: 100) */
  limit?: number;
  /** Time window (e.g., "1m", "5m", "1h", "1d", "1w", "1M") */
  window?: WindowTime;
  /** Custom key generator (default: based on ctx) */
  key?: (ctx: Ctx) => string;
  /** Response message when rate limited (default: "Too many requests") */
  message?: string;
  /** Callback when rate limited */
  onRateLimited?: (key: string, limit: number, windowMs: number) => void;
};

export type RateLimitConfig = {
  enabled: boolean;
  options?: RateLimitOptions;
};
