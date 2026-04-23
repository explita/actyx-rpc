export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type CircuitBreakerOptions = {
  /** Number of failures before opening the circuit (default: 5) */
  failureThreshold?: number;
  /** Cooldown time in ms before transitioning to HALF_OPEN (default: 30000) */
  resetTimeout?: number;
  /** Callback triggered when the state changes */
  onStateChange?: (state: CircuitState, handlerName?: string) => void;
};

export type CircuitBreakerConfig = {
  enabled: boolean;
  options: CircuitBreakerOptions;
};
