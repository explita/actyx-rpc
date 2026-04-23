import type { ErrorResponse } from "../../types/misc.js";

export type RetryBackoff = "fixed" | "linear" | "exponential";

export type RetryOptions = {
  /** Number of retry attempts (default: 3) */
  attempts?: number;
  /** Backoff strategy (default: 'exponential') */
  backoff?: RetryBackoff;
  /** Initial delay in ms (default: 100) */
  initialDelay?: number;
  /** Maximum delay in ms (default: 10000) */
  maxDelay?: number;
  /** Factor for exponential/linear backoff (default: 2) */
  factor?: number;
  /** Should retry on this error? (default: retry on all errors) */
  if?: (error: ErrorResponse) => boolean;
  /** Called before each retry attempt */
  onRetry?: (error: ErrorResponse, attempt: number, delay: number) => void;
  /** Called when all retries exhausted */
  onFailed?: (error: ErrorResponse, attempts: number) => void;
};

export type WithRetryOptions = RetryOptions & {
  enabled?: boolean;
};

export type RetryConfig = {
  enabled: boolean;
  options?: RetryOptions;
};
