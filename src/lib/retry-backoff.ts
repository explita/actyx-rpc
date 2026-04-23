import type { RetryOptions } from "../core/retry/types.js";

export function calculateDelay(
  attempt: number,
  options: Required<
    Pick<RetryOptions, "backoff" | "initialDelay" | "maxDelay" | "factor">
  >,
): number {
  let delay: number;

  switch (options.backoff) {
    case "fixed":
      delay = options.initialDelay;
      break;
    case "linear":
      delay = options.initialDelay * (attempt + 1);
      break;
    case "exponential":
      delay = options.initialDelay * Math.pow(options.factor, attempt);
      break;
    default:
      delay = options.initialDelay * Math.pow(2, attempt);
  }

  return Math.min(delay, options.maxDelay);
}
