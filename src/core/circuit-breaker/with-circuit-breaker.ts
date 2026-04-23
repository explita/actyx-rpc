import type { CircuitBreakerOptions, CircuitState } from "./types.js";

export type CircuitBreakerState = {
  status: CircuitState;
  failures: number;
  lastFailure: number;
};

export function withCircuitBreaker<TInput, TOutput>(
  handler: (
    opts: { ctx: any; input: TInput },
    ...args: any[]
  ) => Promise<TOutput>,
  state: CircuitBreakerState,
  options: CircuitBreakerOptions,
  handlerName?: string,
): (opts: { ctx: any; input: TInput }, ...args: any[]) => Promise<TOutput> {
  const threshold = options.failureThreshold ?? 5;
  const timeout = options.resetTimeout ?? 30000;

  return async (opts, ...args) => {
    const now = Date.now();

    // Check if we should move from OPEN to HALF_OPEN
    if (state.status === "OPEN" && now - state.lastFailure >= timeout) {
      state.status = "HALF_OPEN";
      options.onStateChange?.("HALF_OPEN", handlerName);
    }

    // If OPEN, fail fast
    if (state.status === "OPEN") {
      throw {
        success: false,
        message: "Circuit breaker is OPEN",
        reason: "CIRCUIT_OPEN",
        statusCode: 503, // Service Unavailable
        retryAfter: new Date(state.lastFailure + timeout).toISOString(),
      };
    }

    try {
      const result = await handler(opts, ...args);

      // Successful call logic
      if (state.status === "HALF_OPEN" || state.failures > 0) {
        state.status = "CLOSED";
        state.failures = 0;
        options.onStateChange?.("CLOSED", handlerName);
      }

      return result;
    } catch (error: any) {
      // Don't count validation errors or 4xx as failures
      const isSystemError = !error.statusCode || error.statusCode >= 500;

      if (isSystemError) {
        state.failures++;
        state.lastFailure = Date.now();

        if (state.failures >= threshold) {
          state.status = "OPEN";
          options.onStateChange?.("OPEN", handlerName);
        }
      }

      throw error;
    }
  };
}
