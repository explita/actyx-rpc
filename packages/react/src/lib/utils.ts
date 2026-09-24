import type { WindowTime } from "../types/main.js";

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

export function normalizeKey(
  key?:
    | string
    | unknown[]
    | { getQueryKey: (...args: any[]) => unknown[] }
    | unknown,
): string | undefined {
  if (key === undefined || key === null) return undefined;
  if (typeof key === "string") return key;
  if (
    typeof key === "object" &&
    key !== null &&
    "getQueryKey" in key &&
    typeof (key as any).getQueryKey === "function"
  ) {
    return normalizeKey((key as any).getQueryKey());
  }
  if (Array.isArray(key)) {
    return key
      .map((i) =>
        typeof i === "object" && i !== null ? JSON.stringify(i) : String(i),
      )
      .join("|");
  }
  return String(key);
}

/**
 * Default matcher for {@link UseInfiniteQueryOpts.syncSelection}.
 * Compares items by their `id` property.
 * Used automatically when `syncSelection: true` is set.
 */
export function defaultSyncSelection<TPage extends { id: unknown }>(
  a: TPage,
  b: TPage,
): boolean {
  return a.id === b.id;
}
