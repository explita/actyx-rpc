import type React from "react";
import type { QueryClient } from "../lib/query-client.js";

export type ActyxDevtoolsProps = {
  /**
   * Optional QueryClient instance to inspect.
   * If omitted, automatically resolves from ActyxProvider context or the active cached client.
   */
  client?: QueryClient;
  /**
   * Initial open state of the DevTools panel.
   * @default false
   */
  initialIsOpen?: boolean;
  /**
   * Position of the floating toggle button and panel.
   * @default "bottom-right"
   */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  /**
   * Whether DevTools is enabled.
   * Defaults to true in non-production environments (`process.env.NODE_ENV !== "production"`).
   */
  enabled?: boolean;
  /**
   * Custom style overrides for the root container.
   */
  style?: React.CSSProperties;
};

export type DevtoolsTab = "queries" | "mutations" | "streams";
export type QueryFilter = "all" | "fresh" | "stale" | "fetching" | "error";
