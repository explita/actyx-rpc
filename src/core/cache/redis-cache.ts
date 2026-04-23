import type { Redis } from "ioredis";
import type {
  CacheAdapter,
  CacheEntry,
  RedisCacheOptions,
  RedisInstance,
} from "./types.js";
import { getStaleAt, isStale, parseWindow } from "../../lib/utils.js";

export class RedisCache implements CacheAdapter {
  private redis: Redis;
  private prefix: string;
  private defaultTTL: number;
  private defaultStaleTime: number;
  private serializer: {
    serialize: (value: any) => string;
    deserialize: <T>(value: string) => T;
  };

  constructor(redis: RedisInstance, options: RedisCacheOptions) {
    this.redis = typeof redis === "function" ? redis() : redis;
    this.prefix = options.prefix ?? "actyx:cache:";
    this.defaultTTL = parseWindow(options.defaultTTL ?? "1m"); // milliseconds
    this.defaultStaleTime = parseWindow(options.defaultStaleTime ?? "0m");
    this.serializer = options.serializer ?? {
      serialize: (value) => JSON.stringify(value),
      deserialize: <T>(value: string): T => JSON.parse(value) as T,
    };
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async sets<T>(
    key: string,
    data: T,
    options?: { ttl?: number; staleTime?: number },
  ): Promise<void> {
    if (!data) return;
    const ttl = options?.ttl ?? this.defaultTTL;
    const staleTime = options?.staleTime ?? this.defaultStaleTime;
    const now = Date.now();
    const redisKey = this.getKey(key);

    const pipeline = this.redis.pipeline();

    // Store metadata
    const metadata = {
      expiresAt: now + ttl * 1000,
      staleAt: getStaleAt(staleTime),
      lastAccessed: now,
      createdAt: now,
    };

    // Store data with metadata
    pipeline.set(redisKey, this.serializer.serialize({ data, metadata }));

    if (ttl > 0) {
      pipeline.expire(redisKey, ttl);
    }

    await pipeline.exec();
  }

  async set<T>(
    key: string,
    data: T,
    options?: { ttl?: number; staleTime?: number },
  ): Promise<void> {
    if (data === undefined || data === null) return;
    const ttl = options?.ttl ?? this.defaultTTL;
    const staleTime = options?.staleTime ?? this.defaultStaleTime;
    const now = Date.now();
    const redisKey = this.getKey(key);

    // Store metadata
    const metadata = {
      expiresAt: now + ttl,
      staleAt: getStaleAt(staleTime),
      lastAccessed: now,
      createdAt: now,
    };

    const serialized = this.serializer.serialize({ data, metadata });

    const ttlSeconds = Math.ceil(ttl / 1000);

    if (ttlSeconds > 0) {
      await this.redis.set(redisKey, serialized, "EX", ttlSeconds);
    } else {
      await this.redis.set(redisKey, serialized);
    }
  }

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const redisKey = this.getKey(key);
    const value = await this.redis.get(redisKey);

    if (!value) return undefined;

    const data = this.serializer.deserialize(value) as CacheEntry<T>;

    // Update last accessed time in background
    this.updateLastAccessed(key, data).catch(() => {});

    return {
      data: data.data,
      metadata: data.metadata,
      isStale: isStale(data),
    };
  }

  async isStale(key: string): Promise<boolean> {
    const cacheKey = this.getKey(key);
    const value = await this.redis.get(cacheKey);

    if (!value) return true;

    const data = this.serializer.deserialize<CacheEntry>(value);

    return Date.now() > data.metadata.staleAt;
  }

  async has(key: string): Promise<boolean> {
    const redisKey = this.getKey(key);
    const exists = await this.redis.exists(redisKey);
    if (!exists) return false;

    const isStale = await this.isStale(key);
    return !isStale;
  }

  async delete(key: string): Promise<boolean> {
    const redisKey = this.getKey(key);
    const result = await this.redis.del(redisKey);
    return result > 0;
  }

  async addTag(key: string, tags: string | string[]): Promise<void> {
    const tagList = Array.isArray(tags) ? tags : [tags];
    const pipeline = this.redis.pipeline();

    for (const tag of tagList) {
      const tagKey = `${this.prefix}:tag:${tag}`;
      pipeline.sadd(tagKey, key);
      pipeline.expire(tagKey, 3600); // TTL for tag index
    }

    await pipeline.exec();
  }

  async invalidateByTag(tag: string): Promise<void> {
    const tagKey = `${this.prefix}:tag:${tag}`;
    const keys = await this.redis.smembers(tagKey);

    if (keys.length === 0) return;

    const pipeline = this.redis.pipeline();

    // Delete all cache keys
    for (const key of keys) {
      pipeline.del(key);
    }

    // Delete the tag index
    pipeline.del(tagKey);

    await pipeline.exec();
  }

  async invalidateByTags(tags: string | string[]): Promise<void> {
    const tagList = Array.isArray(tags) ? tags : [tags];

    for (const tag of tagList) {
      await this.invalidateByTag(tag);
    }
  }

  async clear(): Promise<void> {
    const pattern = `${this.prefix}*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async clearByPattern(pattern: string): Promise<void> {
    const fullPattern = `${this.prefix}${pattern}`;
    const keys = await this.redis.keys(fullPattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private async updateLastAccessed(
    key: string,
    entry?: CacheEntry,
  ): Promise<void> {
    const redisKey = this.getKey(key);

    let parsed = entry;
    if (!parsed) {
      const value = await this.redis.get(redisKey);
      if (!value) return;
      parsed = this.serializer.deserialize(value) as CacheEntry;
    }

    parsed.metadata.lastAccessed = Date.now();

    // Refresh TTL
    const ttlSeconds = Math.ceil(
      (parsed.metadata.expiresAt - Date.now()) / 1000,
    );
    if (ttlSeconds > 0) {
      await this.redis.set(
        redisKey,
        this.serializer.serialize(parsed),
        "EX",
        ttlSeconds,
      );
    }
  }

  async size(): Promise<number> {
    const pattern = `${this.prefix}*`;
    const keys = await this.redis.keys(pattern);
    // Filter out meta keys
    return keys.filter((k) => !k.endsWith(":meta")).length;
  }

  async keys(): Promise<string[]> {
    const pattern = `${this.prefix}*`;
    const keys = await this.redis.keys(pattern);
    // Return keys without prefix and filter out meta keys
    return keys
      .filter((k) => !k.endsWith(":meta"))
      .map((k) => k.slice(this.prefix.length));
  }
}
