import type { FailureReason } from "../../types/misc.js";

export type TimeoutOptions = {
  /** Timeout in milliseconds (default: 5000) */
  ms?: number;
  /** Error message on timeout (default: "Request timeout") */
  message?: string;
  /** Error reason (default: "TIMEOUT") */
  reason?: FailureReason;
  /** Callback when timeout occurs */
  onTimeout?: (duration: number) => void;
};

export type TimeoutConfig = {
  enabled: boolean;
  options?: TimeoutOptions;
};
