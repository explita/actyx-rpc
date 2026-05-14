import { CompressionOptions } from "../core/compression/types";

export const DEFAULT_TIMEOUT = 5000;
export const RETRY = {
  ATTEMPTS: 3,
  INITIAL_DELAY: 100,
  MAX_DELAY: 10000,
  FACTOR: 2,
  BACKOFF: "exponential",
};

export const COMPRESSOR = {
  ALGORITHM: "gzip" as Required<CompressionOptions>["algorithm"],
  THRESHOLD: 1024,
  LEVEL: 6,
};

export const CIRCUIT_BREAKER = {
  FAILURE_THRESHOLD: 5,
  RESET_TIMEOUT: 30000,
};
