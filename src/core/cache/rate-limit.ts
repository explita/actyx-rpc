import { parseWindow } from "../../lib/utils.js";
import type { CacheAdapter, RateLimitOptions } from "./types.js";

export async function checkRateLimit(
  cache: CacheAdapter,
  options: RateLimitOptions,
  ctx: any,
  req: Request,
  context: any,
) {
  const limit = options?.limit ?? 100;
  const windowStr = options?.window ?? "1m";
  const windowMs = parseWindow(windowStr);
  const getKey =
    options?.key ??
    ((ctx: any) => ctx.id || ctx.userId || ctx.ip || "anonymous");

  const key = (getKey as any)(ctx, req, context);
  const cacheKey = `ratelimit:${key}`;
  const now = Date.now();

  const cached = await cache.get<{ count: number; resetTime: number }>(
    cacheKey,
  );
  let entry = cached?.data;

  if (!entry || now > entry.resetTime) {
    // New window
    const resetTime = now + windowMs;

    await cache.set(cacheKey, { count: 1, resetTime }, { ttl: windowMs });

    return { allowed: true, remaining: limit - 1, resetTime };
  }

  if (entry.count >= limit) {
    options.onRateLimited?.(key, limit, windowMs, req, context);
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      error: {
        success: false,
        message:
          options?.message ??
          `Too many requests. Limit: ${limit} per ${windowStr}`,
        reason: "RATE_LIMITED",
        statusCode: 429,
        retryAfter: new Date(entry.resetTime).toISOString(),
      },
    };
  }

  // Increment count
  const newCount = entry.count + 1;

  await cache.set(
    cacheKey,
    { count: newCount, resetTime: entry.resetTime },
    {
      ttl: Math.max(0, entry.resetTime - now),
    },
  );

  return {
    allowed: true,
    remaining: limit - newCount,
    resetTime: entry.resetTime,
  };
}
