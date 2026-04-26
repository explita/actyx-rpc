import crypto from "crypto";

import type { CacheEntry } from "../core/cache/types.js";
import type { ProcedureProps } from "../types/procedure.js";

export function normalizeInput(data: unknown) {
  if (data instanceof FormData) {
    return Object.fromEntries(data.entries());
  }
  return (data ?? {}) as Record<string, unknown>;
}

export function mergeConfigs<TCtx, TEnrich>(
  base: ProcedureProps<TCtx, TEnrich, any>,
  override: any,
): ProcedureProps<any, any, any> {
  const merged: ProcedureProps<any, any, any> = {
    ...base,
    ...(override ?? {}),

    // Merge meta
    meta: { ...(base.meta ?? {}), ...(override?.meta ?? {}) },

    // arrays → compose (important!)
    middlewares: [...(base.middlewares ?? []), ...(override.middlewares ?? [])],

    plugins: [...(base.plugins ?? []), ...(override.plugins ?? [])],
  };

  if (override.createContext) {
    merged.createContext = async (prevCtx?: any) => {
      const res = await base.createContext(prevCtx);
      if (!res.ok) return res;
      return override.createContext({ ...prevCtx, ...res.ctx });
    };
  }

  if (override.enrichInput) {
    merged.enrichInput = async (ctx: any) => {
      const baseEnriched = base.enrichInput ? await base.enrichInput(ctx) : {};
      return override.enrichInput({ ctx, previous: baseEnriched });
    };
  }

  return merged;
}

export function hashKey(input: unknown) {
  const str = JSON.stringify(input);
  return crypto.createHash("md5").update(str).digest("hex");
}

export function getStaleAt(staleTime: number) {
  return staleTime === 0 ? Infinity : Date.now() + staleTime;
}

export function isStale(entry: CacheEntry) {
  return entry.metadata.staleAt ? Date.now() > entry.metadata.staleAt : false;
}

export function isErrorResponse(result: unknown): boolean {
  return (
    result !== null &&
    typeof result === "object" &&
    "success" in result &&
    result.success === false
  );
}

export function toError(err: unknown) {
  if (err instanceof Error) {
    return {
      success: false,
      message: err.message,
      reason: err.name ?? "UNEXPECTED_ERROR",
    };
  }

  return {
    success: false,
    message: "Unknown error",
    reason: "UNEXPECTED_ERROR",
  };
}

function isSerializedBuffer(data: any): boolean {
  return (
    data &&
    typeof data === "object" &&
    data.type === "Buffer" &&
    Array.isArray(data.data)
  );
}

export function toBuffer(data: any): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (isSerializedBuffer(data)) return Buffer.from(data.data);
  return data;
}

export function parseWindow(
  window: `${number}${"m" | "h" | "d" | "w" | "M"}` | number,
): number {
  if (typeof window === "number") return window;

  try {
    const value = parseInt(window.slice(0, -1));
    const unit = window.slice(-1);

    switch (unit) {
      case "m": // minutes
        return value * 60 * 1000;
      case "h": // hours
        return value * 60 * 60 * 1000;
      case "d": // days
        return value * 24 * 60 * 60 * 1000;
      case "w": // weeks
        return value * 7 * 24 * 60 * 60 * 1000;
      case "M": // months (30 days)
        return value * 30 * 24 * 60 * 60 * 1000;
      default:
        return 60000; // default 1 minute
    }
  } catch (error) {
    return 0;
  }
}

export function getFinalStatusCode(originalError: any): number {
  if (originalError?.statusCode) {
    return originalError.statusCode;
  }

  // Determine based on error type
  if (
    originalError?.code === "ECONNRESET" ||
    originalError?.code === "ETIMEDOUT"
  ) {
    return 503; // Service Unavailable
  }

  if (originalError?.name === "TimeoutError") {
    return 504; // Gateway Timeout
  }

  return 500; // Internal Server Error
}
