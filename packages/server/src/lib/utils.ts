import crypto from "crypto";

import type { CacheEntry, WindowTime } from "../core/cache/types.js";
import type { ProcedureProps } from "../types/procedure.js";

export function convertNumericKeysToArrays(val: any): any {
  if (typeof val !== "object" || val === null) return val;
  if (
    val instanceof Blob ||
    val instanceof FormData ||
    (typeof File !== "undefined" && val instanceof File)
  ) {
    return val;
  }
  if (Array.isArray(val)) return val.map(convertNumericKeysToArrays);
  const processed: any = {};
  for (const [k, v] of Object.entries(val)) {
    processed[k] = convertNumericKeysToArrays(v);
  }
  const keys = Object.keys(processed);
  if (keys.length === 0) return processed;
  const isNumeric = keys.every((k) => {
    const num = Number(k);
    return Number.isInteger(num) && num >= 0 && String(num) === k;
  });
  if (isNumeric) {
    const max = Math.max(...keys.map(Number));
    const arr = new Array(max + 1);
    for (const [k, v] of Object.entries(processed)) {
      arr[Number(k)] = v;
    }
    return arr;
  }
  return processed;
}

/**
 * Converts a FormData instance into a structured object,
 * parsing bracket notation (`files[0]`, `user[name]`), repeated keys as arrays,
 * and converting numeric keys into real arrays.
 */
export function formDataToObject(formData: any): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "__direct_file__" || key === "args") continue;

    let parsedValue: any = value;
    if (
      typeof value === "string" &&
      (value.startsWith("{") || value.startsWith("["))
    ) {
      try {
        parsedValue = JSON.parse(value);
      } catch {}
    }

    const parts = key.split(/[\[\]\.]/).filter(Boolean);
    let current = obj;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        if (current[part] !== undefined) {
          if (Array.isArray(current[part])) {
            current[part].push(parsedValue);
          } else {
            current[part] = [current[part], parsedValue];
          }
        } else {
          current[part] = parsedValue;
        }
      } else {
        current[part] = current[part] || {};
        current = current[part];
      }
    }
  }

  return convertNumericKeysToArrays(obj);
}

export function normalizeInput(data: unknown) {
  if (!data) return {};

  // Direct File/Blob check: preserve as-is
  if (
    (typeof Blob !== "undefined" && data instanceof Blob) ||
    (typeof File !== "undefined" && data instanceof File)
  ) {
    return data;
  }

  // Robust FormData check
  if (
    data instanceof FormData ||
    (typeof data === "object" &&
      "entries" in data &&
      typeof (data as any).entries === "function")
  ) {
    const fd = data as any;
    if (typeof fd.get === "function" && fd.get("__direct_file__") === "true") {
      return fd.get("file");
    }

    return formDataToObject(fd);
  }
  return data as Record<string, unknown>;
}

export function parseJson<T = unknown>(data: string) {
  try {
    return JSON.parse(data) as T;
  } catch {
    return data as T;
  }
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
    merged.createContext = async (prevCtx?: any, req?: any, context?: any) => {
      const res = await base.createContext(prevCtx, req, context);
      if (!res.ok) return res;
      return override.createContext({ ...prevCtx, ...res.ctx }, req, context);
    };
  }

  if (override.enrichInput) {
    merged.enrichInput = async (ctx: any, req?: any, context?: any) => {
      const baseEnriched = base.enrichInput
        ? await base.enrichInput(ctx, req, context)
        : {};
      return override.enrichInput(
        { ctx, previous: baseEnriched },
        req,
        context,
      );
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

export function parseWindow(window?: WindowTime): number {
  if (window === undefined) return 0;
  if (typeof window === "number") return window;

  try {
    const value = parseInt(window.slice(0, -1));
    const unit = window.slice(-1);

    switch (unit) {
      case "s": // seconds
        return value * 1000;
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
        return 0;
    }
  } catch {
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
