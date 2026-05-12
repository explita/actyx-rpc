import type { Plugin } from "../types/middleware.js";

export type ObservabilityOptions = {
  onCall?: (data: {
    name: string;
    duration: number;
    success: boolean;
    error?: any;
    input: any;
  }) => void;
};

const START_TIMES_KEY = Symbol("observability_start_times");

/**
 * A plugin that tracks procedure execution metrics.
 *
 * It uses a stack-based approach to correctly track durations
 * even when procedures call each other internally.
 */
export function observabilityPlugin(
  options: ObservabilityOptions = {},
): Plugin<any, any, any, any, any> {
  return {
    onBefore: async ({ ctx, next }) => {
      // Initialize or retrieve the stack of start times
      if (!(ctx as any)[START_TIMES_KEY]) {
        (ctx as any)[START_TIMES_KEY] = [];
      }

      // Push current time to the stack
      (ctx as any)[START_TIMES_KEY].push(Date.now());

      return next();
    },
    onAfter: async (ctx, result) => {
      const stack = (ctx as any)[START_TIMES_KEY];
      if (stack && stack.length > 0) {
        const start = stack.pop();
        const duration = Date.now() - start;

        options.onCall?.({
          name: ctx.handlerName,
          duration,
          success: true,
          input: {}, // Input extraction could be improved if needed
        });
      }
    },
    onError: async ({ ctx, error, input }) => {
      const stack = (ctx as any)[START_TIMES_KEY];
      if (stack && stack.length > 0) {
        const start = stack.pop();
        const duration = Date.now() - start;

        options.onCall?.({
          name: ctx.handlerName,
          duration,
          success: false,
          error,
          input,
        });
      }
    },
  };
}
