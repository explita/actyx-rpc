import type { FailureReason } from "../types/misc.js";

export class CacheKeyException extends Error {
  public readonly statusCode: number;
  public readonly reason: FailureReason;
  public readonly code: string;

  constructor(
    message: string,
    options?: { reason?: FailureReason; statusCode?: number },
  ) {
    super(message);
    this.name = "CacheKeyException";
    this.reason = options?.reason ?? "INVALID_CACHE_KEY";
    this.statusCode = options?.statusCode ?? 400;
    this.code = this.reason;
  }
}
