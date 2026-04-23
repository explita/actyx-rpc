import { mergeConfigs } from "../lib/utils.js";
import { MemoryCache } from "./cache/memory-cache.js";
import type {
  CacheInvalidationOptions,
  RateLimitOptions,
  WithCacheOptions,
} from "./cache/types.js";
import { withCache } from "./cache/with-cache.js";
import type { RetryOptions } from "./retry/types.js";
import { withRetry } from "./retry/with-retry.js";
import { handlerResolver } from "./helpers/handler-resolver.js";
import type { TimeoutOptions } from "./timeout/types.js";
import { withTimeout } from "./timeout/with-timeout.js";
import {
  withCircuitBreaker,
  type CircuitBreakerState,
} from "./circuit-breaker/with-circuit-breaker.js";
import type { CircuitBreakerOptions } from "./circuit-breaker/types.js";
import type { CompressionOptions } from "./compression/types.js";
import { Compressor } from "./compression/compressor.js";
import { withCompression } from "./compression/with-compression.js";
import type {
  ProcedureConfig,
  ProcedureInstance,
  ProcedureProps,
} from "../types/procedure.js";
import { withInvalidation } from "./cache/with-invalidation.js";

export function createProcedure<
  TCtx extends Record<string, unknown>,
  TEnrich extends Record<string, unknown> = {},
  //@ts-ignore
  GIM extends InputMode,
>(opts: ProcedureProps<TCtx, TEnrich, GIM>) {
  const globalCache = opts.cache ?? new MemoryCache();
  const globalCompressor = opts.compression ?? new Compressor();

  function procedureBuilder<I = undefined, Ctx = TCtx>(
    config: ProcedureConfig<Ctx, TEnrich> = {},
  ): ProcedureInstance<Ctx, TEnrich, I, GIM, GIM> {
    const nextConfig = { ...config };

    return {
      name(name) {
        return procedureBuilder({ ...nextConfig, name });
      },
      circuitBreaker: (options?: CircuitBreakerOptions) => {
        const state: CircuitBreakerState = nextConfig.circuitBreaker?.state ?? {
          status: "CLOSED",
          failures: 0,
          lastFailure: 0,
        };

        return procedureBuilder<I, Ctx>({
          ...nextConfig,
          circuitBreaker: {
            enabled: true,
            options: options ?? {},
            state,
          },
        });
      },
      telemetry: () => {
        return procedureBuilder<I, Ctx>({
          ...nextConfig,
          telemetry: true,
        });
      },
      //@ts-ignore
      extend(override) {
        //@ts-ignore
        return createProcedure(mergeConfigs<TCtx, TEnrich>(opts, override));
      },

      cache: <TInput = I>(
        options?: WithCacheOptions<Ctx & TEnrich, TInput>,
      ) => {
        return procedureBuilder<I, Ctx>({
          ...nextConfig,
          cache: {
            enabled: true,
            //@ts-ignore
            options,
          },
        });
      },

      invalidate: (options: CacheInvalidationOptions<Ctx, I>) => {
        return procedureBuilder<I, Ctx>({
          ...nextConfig,
          invalidate: {
            enabled: true,
            //@ts-ignore
            options,
          },
        });
      },

      retry: (options?: RetryOptions) => {
        return procedureBuilder<I, Ctx>({
          ...nextConfig,
          retry: {
            enabled: true,
            options,
          },
        });
      },

      timeout: (options?: TimeoutOptions) => {
        return procedureBuilder<I, Ctx>({
          ...nextConfig,
          timeout: {
            enabled: true,
            options,
          },
        });
      },

      compress: (options?: CompressionOptions) => {
        return procedureBuilder<I, Ctx>({
          ...nextConfig,
          compression: {
            enabled: true,
            options,
          },
        });
      },

      rateLimit: (options?: RateLimitOptions<Ctx>) => {
        return procedureBuilder<I, Ctx>({
          ...nextConfig,
          rateLimit: {
            enabled: true,
            //@ts-ignore
            options,
          },
        });
      },

      middleware(mw) {
        return mw;
      },

      plugin(plugin) {
        return plugin;
      },

      //@ts-ignore
      use(mwOrPlugin: Middleware<any, any, any, any> | Plugin<any, any, any>) {
        const isPlugin = typeof mwOrPlugin !== "function";

        const nextConfig: ProcedureConfig<Ctx, TEnrich> = {
          ...config,

          middlewares: isPlugin
            ? config.middlewares
            : [...(config.middlewares ?? []), mwOrPlugin],

          plugins: isPlugin
            ? [...(config.plugins ?? []), mwOrPlugin]
            : config.plugins,
        };

        return procedureBuilder<I, Ctx>(nextConfig);
      },

      //@ts-ignore
      input<T>(r: SchemaResolver<T>, options?: InputCtx) {
        return procedureBuilder<T, Ctx>({
          ...config,
          resolver: r,
        });
      },

      resolve<O, P = any>(
        handler: (opts: { ctx: Ctx; input: any }, ...args: P[]) => Promise<O>,
      ) {
        return handlerResolver(handler, opts, config, globalCache);
      },

      mutation(handler) {
        let exec = handler;

        // Apply invalidation after mutation
        if (nextConfig.invalidate?.enabled && nextConfig.invalidate.options) {
          exec = withInvalidation(
            exec as any,
            globalCache,
            nextConfig.invalidate.options,
          ) as any;
        }

        if (nextConfig.circuitBreaker?.enabled) {
          exec = withCircuitBreaker(
            exec as any,
            nextConfig.circuitBreaker.state,
            nextConfig.circuitBreaker.options,
            nextConfig.name,
          ) as any;
        }

        //@ts-ignore
        return this.resolve(exec);
      },

      query(handler) {
        let exec = handler;

        if (nextConfig.compression?.enabled) {
          exec = withCompression(
            exec as any,
            globalCompressor,
            nextConfig.compression.options,
          ) as any;
        }

        if (nextConfig.timeout?.enabled) {
          exec = withTimeout(exec as any, nextConfig.timeout.options) as any;
        }

        if (config.retry?.enabled) {
          exec = withRetry(exec as any, config.retry.options) as any;
        }

        if (config.cache?.enabled) {
          exec = withCache(
            exec as any,
            globalCache,
            config.cache.options,
          ) as any;
        }

        if (nextConfig.circuitBreaker?.enabled) {
          exec = withCircuitBreaker(
            exec as any,
            nextConfig.circuitBreaker.state,
            nextConfig.circuitBreaker.options,
            nextConfig.name,
          ) as any;
        }

        //@ts-ignore
        return this.resolve(exec);
      },
    };
  }

  return procedureBuilder();
}
