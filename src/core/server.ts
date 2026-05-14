import { mergeConfigs } from "../lib/utils.js";
import { MemoryCache } from "./cache/memory-cache.js";
import { MemoryPubSub, RedisPubSub } from "../lib/pubsub.js";
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
import type { Middleware, Plugin } from "../types/middleware.js";
import type {
  ProcedureConfig,
  ProcedureInstance,
  ProcedureProps,
} from "../types/procedure.js";
import { withInvalidation } from "./cache/with-invalidation.js";
import type {
  InputMode,
  InputCtx,
  SchemaResolver,
  Prettify,
} from "../types/misc.js";
import { RedisCache } from "./cache/redis-cache.js";

export function createProcedure<
  TCtx extends Record<string, unknown>,
  TEnrich extends Record<string, unknown> = {},
  TMeta extends Record<string, any> = {},
  GIM extends InputMode = InputMode,
>(opts: ProcedureProps<TCtx, TEnrich, GIM, TMeta>) {
  opts = opts ?? {};
  const globalCache = opts.cache ?? new MemoryCache();
  const globalCompressor = opts.compression ?? new Compressor();

  // Reuse Redis instance from cache if available for PubSub
  const redisInstance = (globalCache as RedisCache).redis;
  const globalPubSub = redisInstance
    ? new RedisPubSub(redisInstance)
    : new MemoryPubSub();

  // Default implementations
  opts.createContext ??= (async () => ({ ok: true, ctx: {} as any })) as any;

  function procedureBuilder<
    I = undefined,
    Ctx = TCtx,
    TLocalMeta extends Record<string, any> = TMeta,
    TICtx extends InputCtx = {},
    TName extends string = string,
  >(
    config: ProcedureConfig<Ctx, TEnrich, TLocalMeta> = {
      name: "unnamed",
    },
  ): ProcedureInstance<Ctx, TEnrich, TLocalMeta, I, TICtx, GIM, TName> {
    const nextConfig = { ...config };

    return {
      name(name) {
        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, typeof name>({
          ...nextConfig,
          name,
        });
      },
      meta(meta) {
        return procedureBuilder<I, Ctx, any, TICtx, TName>({
          ...nextConfig,
          meta: { ...(nextConfig.meta as any), ...(meta as any) },
        });
      },
      circuitBreaker: (options?: CircuitBreakerOptions) => {
        const state: CircuitBreakerState = nextConfig.circuitBreaker?.state ?? {
          status: "CLOSED",
          failures: 0,
          lastFailure: 0,
        };

        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, TName>({
          ...nextConfig,
          circuitBreaker: {
            enabled: true,
            options: options ?? {},
            state,
          },
        });
      },
      telemetry: () => {
        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, TName>({
          ...nextConfig,
          telemetry: true,
        });
      },
      //@ts-ignore
      extend(override) {
        //@ts-ignore
        return createProcedure(mergeConfigs<TCtx, TEnrich>(opts, override));
      },

      //@ts-ignore
      cache: (options?: WithCacheOptions<Prettify<Ctx & TEnrich>, I>) => {
        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, TName>({
          ...nextConfig,
          cache: {
            enabled: true,
            //@ts-ignore
            options,
          },
        });
      },

      //@ts-ignore
      invalidate: (options: CacheInvalidationOptions<Ctx, I>) => {
        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, TName>({
          ...nextConfig,
          invalidate: {
            enabled: true,
            //@ts-ignore
            options,
          },
        });
      },

      retry: (options?: RetryOptions) => {
        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, TName>({
          ...nextConfig,
          retry: {
            enabled: true,
            options,
          },
        });
      },

      timeout: (options?: TimeoutOptions) => {
        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, TName>({
          ...nextConfig,
          timeout: {
            enabled: true,
            options,
          },
        });
      },

      compress: (options?: CompressionOptions) => {
        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, TName>({
          ...nextConfig,
          compression: {
            enabled: true,
            options,
          },
        });
      },

      //@ts-ignore
      rateLimit: (options?: RateLimitOptions<Ctx, TLocalMeta>) => {
        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, TName>({
          ...nextConfig,
          rateLimit: {
            enabled: true,
            //@ts-ignore
            options,
          },
        });
      },

      authorize: (checker) => {
        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, TName>({
          ...nextConfig,
          authorize: checker as any,
        });
      },

      //@ts-ignore
      mock: (handlers) => {
        return procedureBuilder({
          ...nextConfig,
          mock: handlers as any,
        });
      },

      summary: (text) => {
        return procedureBuilder({
          ...nextConfig,
          summary: text,
        });
      },

      description: (text) => {
        return procedureBuilder({
          ...nextConfig,
          description: text,
        });
      },

      output: (resolver) => {
        return procedureBuilder({
          ...nextConfig,
          outputResolver: resolver,
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

        const nextConfig: ProcedureConfig<Ctx, TEnrich, TLocalMeta> = {
          ...config,

          middlewares: isPlugin
            ? config.middlewares
            : [...(config.middlewares ?? []), mwOrPlugin],

          plugins: isPlugin
            ? [...(config.plugins ?? []), mwOrPlugin]
            : config.plugins,
        };

        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, TName>(nextConfig);
      },

      input<T, NextICtx extends InputCtx>(r: SchemaResolver<T>) {
        return procedureBuilder<T, Ctx, TLocalMeta, NextICtx, TName>({
          ...config,
          resolver: r,
        });
      },

      resolve<O, P = any>(
        handler: (opts: { ctx: Ctx; input: any }, ...args: P[]) => Promise<O>,
      ) {
        return handlerResolver(
          handler,
          //@ts-ignore
          opts,
          config,
          globalCache,
          globalPubSub,
        );
      },

      //@ts-ignore
      mutation(handler) {
        const nextConfig = { ...config, type: "mutation" };
        let exec = handler;

        if (nextConfig.timeout?.enabled) {
          console.warn(
            `\x1b[33m[Actyx RPC] Warning: Timeout is configured but will be ignored in mutation procedure "${nextConfig.name}". Mutations do not support timeouts to prevent partial executions.\x1b[0m`,
          );
        }

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
        const resolvedFn = this.resolve(exec);

        const terminal = async function (this: any, ...args: any[]) {
          // Call the resolved function to get the tuple with this context
          const [result, error] = await resolvedFn.apply(this, args);

          // Handle redirect response
          if (error) {
            if ("_redirect" in error && typeof error._redirect === "function") {
              error._redirect();
            }
            delete error._redirect;
          }

          return [result, error];
        };

        (terminal as any)._def = nextConfig;
        return terminal;
      },

      //@ts-ignore
      query(handler) {
        const nextConfig = { ...config, type: "query" };
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
        const resolvedFn = this.resolve(exec);

        const terminal = async function (this: any, ...args: any[]) {
          // Call the resolved function to get the tuple with this context
          const [result, error] = await resolvedFn.apply(this, args);

          // Handle redirect response
          if (error) {
            if ("_redirect" in error && typeof error._redirect === "function") {
              error._redirect();
            }
            delete error._redirect;
          }

          return [result, error];
        };

        (terminal as any)._def = nextConfig;
        return terminal;
      },

      //@ts-ignore
      stream(handler) {
        //@ts-ignore
        const resolvedFn = this.resolve(handler);

        const terminal = async function* (...args: any[]) {
          const [result, error] = await resolvedFn(...args);
          if (error) {
            if ("_redirect" in error && typeof error._redirect === "function") {
              error._redirect();
            }
            delete error._redirect;

            yield { error };
            return;
          }

          if (
            result &&
            typeof result === "object" &&
            (Symbol.asyncIterator in result || Symbol.iterator in result)
          ) {
            yield* result;
          } else {
            yield result;
          }
        };

        (terminal as any)._def = { ...config, type: "stream" };
        return terminal;
      },

      //@ts-ignore
      sse(handler) {
        //@ts-ignore
        const resolvedFn = this.resolve(handler);

        const terminal = async function* (...args: any[]) {
          const [result, error] = await resolvedFn(...args);
          if (error) {
            if ("_redirect" in error && typeof error._redirect === "function") {
              error._redirect();
            }
            delete error._redirect;

            yield { event: "error", data: error };
            return;
          }

          if (
            result &&
            typeof result === "object" &&
            (Symbol.asyncIterator in result || Symbol.iterator in result)
          ) {
            yield* result;
          } else {
            yield result;
          }
        };

        (terminal as any)._def = { ...config, type: "sse" };
        return terminal;
      },

      //@ts-ignore
      subscription(handler) {
        const nextConfig = { ...config, type: "subscription" };

        const terminal = function (payload?: any, ...args: any[]) {
          return async (wsContext: {
            send: (data: any) => void;
            onMessage: (cb: (data: any) => void) => void;
            onClose: (cb: () => void) => void;
            onError: (cb: (err: any) => void) => void;
          }) => {
            // We reuse the resolve logic to get context and input
            // But since subscription is a long-running process, we need a custom executor
            const resolvedFn = handlerResolver(
              async ({ ctx, input }, ...args) => {
                // This is the "setup" phase of the subscription
                const emit = (data: any) => {
                  wsContext.send({ type: "event", data });
                };

                //@ts-ignore
                const cleanup = await handler({ ctx, input, emit }, ...args);

                if (typeof cleanup === "function") {
                  wsContext.onClose(cleanup);
                }

                return { subscribed: true };
              },
              //@ts-ignore
              opts,
              nextConfig,
              globalCache,
              globalPubSub,
            );

            const [result, error] = await resolvedFn(payload, ...args);

            if (error) {
              wsContext.send({ type: "error", error });
              wsContext.onError?.(error);
            } else {
              wsContext.send({ type: "subscribed", data: result });
            }
          };
        };

        (terminal as any)._def = nextConfig;
        return terminal;
      },

      //@ts-ignore
      ws(handler) {
        const nextConfig = { ...config, type: "ws" };

        const terminal = function (payload?: any, ...args: any[]) {
          return async (wsContext: {
            send: (data: any) => void;
            onMessage: (cb: (data: any) => void) => void;
            onClose: (cb: () => void) => void;
            onError: (cb: (err: any) => void) => void;
          }) => {
            const resolvedFn = handlerResolver(
              async ({ ctx, input }) => {
                return await handler({
                  ctx,
                  input,
                  send: wsContext.send,
                  onMessage: wsContext.onMessage,
                  onClose: wsContext.onClose,
                  onError: wsContext.onError,
                });
              },
              //@ts-ignore
              opts,
              nextConfig,
              globalCache,
              globalPubSub,
            );

            const [result, error] = await resolvedFn(payload, ...args);

            if (error) {
              wsContext.onError?.(error);
            }

            return [result, error];
          };
        };

        (terminal as any)._def = nextConfig;
        return terminal;
      },
    };
  }

  return procedureBuilder({
    meta: opts.meta,
    middlewares: opts.middlewares,
    plugins: opts.plugins,
    name: "unnamed",
  });
}
