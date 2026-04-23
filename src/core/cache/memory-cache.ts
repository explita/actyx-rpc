import { getStaleAt, isStale, parseWindow } from "../../lib/utils.js";
import type { CacheAdapter, CacheEntry, WindowTime } from "./types.js";

export class MemoryCache implements CacheAdapter {
  private cache = new Map<string, CacheEntry>();
  private tags = new Map<string, Set<string>>();
  private maxSize: number;
  private defaultTTL: number;
  private defaultStaleTime: number;

  constructor(options?: {
    maxSize?: number;
    defaultTTL?: WindowTime;
    defaultStaleTime?: WindowTime;
  }) {
    this.maxSize = options?.maxSize ?? 100;
    this.defaultTTL = parseWindow(options?.defaultTTL ?? "2m"); //
    this.defaultStaleTime = parseWindow(options?.defaultStaleTime ?? "0m");
  }

  set<T>(
    key: string,
    data: T,
    options?: { ttl?: number; staleTime?: number },
  ): void {
    if (data === undefined || data === null) return;

    const ttl = options?.ttl ?? this.defaultTTL;
    const staleTime = options?.staleTime ?? this.defaultStaleTime;
    const now = Date.now();

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.getOldestEntry();
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(key, {
      data,
      metadata: {
        expiresAt: now + ttl,
        staleAt: getStaleAt(staleTime),
        lastAccessed: now,
        createdAt: now,
        hash: this.hashKey(key),
      },
      isStale: false,
    });
  }

  get<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    entry.metadata.lastAccessed = Date.now();

    // Check if expired
    if (Date.now() > entry.metadata.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return {
      data: entry.data as T,
      metadata: entry.metadata,
      isStale: isStale(entry),
    };
  }

  isStale(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return true;
    return Date.now() > entry.metadata.staleAt;
  }

  has(key: string): boolean {
    return this.cache.has(key) && !this.isStale(key);
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  async addTag(key: string, tags: string | string[]): Promise<void> {
    tags = Array.isArray(tags) ? tags : [tags];

    for (const tag of tags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag)!.add(key);
    }
  }

  async invalidateByTag(tag: string): Promise<void> {
    const keys = this.tags.get(tag);
    if (keys) {
      for (const key of keys) {
        this.cache.delete(key);
      }
      this.tags.delete(tag);
    }
  }

  async clearByPattern(pattern: string): Promise<void> {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  size(): number {
    return this.cache.size;
  }

  private getOldestEntry(): string | undefined {
    let oldest: string | undefined;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.metadata.lastAccessed < oldestTime) {
        oldestTime = entry.metadata.lastAccessed;
        oldest = key;
      }
    }

    return oldest;
  }

  private hashKey(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString();
  }
}
