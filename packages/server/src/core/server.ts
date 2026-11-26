import { mergeConfigs } from "../lib/utils.js";
import { MemoryCache } from "./cache/memory-cache.js";
import {
  MemoryPubSub,
  RedisPubSub,
  type PubSubAdapter,
} from "../lib/pubsub.js";
import type {
  CacheInvalidationOptionsInput,
  RateLimitOptions,
  WithCacheOptionsInput,
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
  Middleware,
  Plugin,
  RootMiddleware,
  RootPlugin,
} from "../types/middleware.js";
import type {
  ProcedureConfig,
  ProcedureInstance,
  ProcedureProps,
} from "../types/procedure.js";
import { withInvalidation } from "./cache/with-invalidation.js";
import type {
  InputMode,
  InputCtx,
  Prettify,
  MergedRootCtx,
} from "../types/misc.js";
import { RedisCache } from "./cache/redis-cache.js";
import { getContext } from "./helpers/get-context.js";
import { webRouter } from "./helpers/web-router.js";
import { toSchemaResolver } from "./helpers/to-schema-resolver.js";
import { parseFrameworkError } from "../lib/parse-framework-error.js";

/**
 * Creates a root RPC procedure builder instance.
 *
 * Configures the base context creation factory, input enrichment, lifecycle hooks (`onError`, `onSuccess`),
 * default middlewares, plugins, cache adapters, and response compression for all derived procedures.
 *
 * @template TCtx - The base context object constructed by `createContext` for each incoming request.
 * @template TEnrich - Enriched input data automatically injected into procedures via `enrichInput`.
 * @template TMeta - Base custom metadata record attached to all derived procedures.
 * @template GIM - The default global input validation mode (`strict`, `form`, `patch`, etc.).
 *
 * @param opts - Configuration options for initializing the root procedure builder.
 * @returns A fluid `ProcedureInstance` builder ready for chaining validation, middlewares, and terminal endpoints (`query`, `mutation`, `stream`, `sse`, `webRoute`, `ws`).
 *
 * @example
 * ```ts
 * import { createProcedure } from "@explita/actyx-rpc";
 * import { z } from "zod";
 *
 * export const procedure = createProcedure({
 *   createContext: async (prevCtx, req) => {
 *     const user = await authenticate(req);
 *     return { ok: true, ctx: { user } };
 *   },
 *   onError: ({ error, ctx }) => {
 *     console.error("RPC Error:", error);
 *   },
 * });
 *
 * export const getUser = procedure
 *   .input(z.object({ id: z.string() }))
 *   .query(async ({ input, ctx }) => {
 *     return ctx.user;
 *   });
 * ```
 */
export function createProcedure<
  TCtx extends Record<string, unknown> = {},
  TEnrich extends Record<string, unknown> = {},
  TMeta extends Record<string, any> = {},
  GIM extends InputMode = InputMode,
  const TMiddlewares extends readonly RootMiddleware<
    NoInfer<TCtx>,
    NoInfer<TEnrich>,
    NoInfer<TMeta>
  >[] = readonly RootMiddleware<
    NoInfer<TCtx>,
    NoInfer<TEnrich>,
    NoInfer<TMeta>
  >[],
  const TPlugins extends readonly RootPlugin<
    NoInfer<TCtx>,
    NoInfer<TEnrich>,
    NoInfer<TMeta>
  >[] = readonly RootPlugin<NoInfer<TCtx>, NoInfer<TEnrich>, NoInfer<TMeta>>[],
>(
  opts: ProcedureProps<
    TCtx,
    TEnrich,
    GIM,
    TMeta,
    TMeta,
    TMiddlewares,
    TPlugins
  >,
): ProcedureInstance<
  MergedRootCtx<TCtx, TMiddlewares, TPlugins>,
  TEnrich,
  TMeta,
  void,
  any,
  GIM,
  "unnamed"
> {
  const resolvedOpts = opts ?? {};
  const globalCache = resolvedOpts.cache ?? new MemoryCache();
  const globalCompressor = resolvedOpts.compression ?? new Compressor();

  // Reuse Redis instance from cache if available for PubSub
  const redisInstance = (globalCache as RedisCache).redis;
  let globalPubSub: PubSubAdapter;
  if (redisInstance) {
    globalPubSub = new RedisPubSub(redisInstance);
  } else {
    const globalKey = "__actyx_rpc_pubsub__";
    if (!(globalThis as any)[globalKey]) {
      (globalThis as any)[globalKey] = new MemoryPubSub();
    }
    globalPubSub = (globalThis as any)[globalKey];
  }

  // Default implementations
  resolvedOpts.createContext ??= (async () => ({
    ok: true,
    ctx: {} as any,
  })) as any;

  function procedureBuilder<
    I = void,
    Ctx = TCtx,
    TLocalMeta extends Record<string, any> = TMeta,
    TICtx extends InputCtx = {},
    TName extends string = string,
  >(
    config: ProcedureConfig<Ctx, TEnrich, TLocalMeta>,
  ): ProcedureInstance<Ctx, TEnrich, TLocalMeta, I, TICtx, GIM, TName> {
    const nextConfig = { ...config };

    return {
      name<NextName extends string>(name: NextName) {
        return procedureBuilder<I, Ctx, TLocalMeta, TICtx, NextName>({
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
        return createProcedure(
          //@ts-ignore
          mergeConfigs<TCtx, TEnrich>(resolvedOpts, override),
        );
      },

      //@ts-ignore
      cache: <P extends unknown[] = any[]>(
        options?: WithCacheOptionsInput<Prettify<Ctx & TEnrich>, I, P>,
      ) => {
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
      invalidate: <P extends unknown[] = any[]>(
        options: CacheInvalidationOptionsInput<Ctx, I, P>,
      ) => {
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
      rateLimit: (options?: RateLimitOptions<Ctx, I, TLocalMeta>) => {
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
          outputResolver: toSchemaResolver(resolver),
        });
      },

      get context() {
        return getContext();
      },

      middleware(mw?: any) {
        // Supports both `middleware(mw)` and `middleware<ExpectedInput>()(mw)`.
        return mw === undefined ? (inner: any) => inner : mw;
      },

      plugin(plugin?: any) {
        return plugin === undefined ? (inner: any) => inner : plugin;
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

      input(r: any) {
        return procedureBuilder({
          ...config,
          resolver: toSchemaResolver(r),
        });
      },

      resolve<O, P = any>(
        handler: (opts: { ctx: Ctx; input: any }, ...args: P[]) => Promise<O>,
        overrideConfig?: Partial<ProcedureConfig<Ctx, TEnrich, TLocalMeta>>,
      ) {
        return handlerResolver(
          handler,
          //@ts-ignore
          resolvedOpts,
          overrideConfig ? { ...nextConfig, ...overrideConfig } : nextConfig,
          globalCache,
          globalPubSub,
        );
      },

      //@ts-ignore
      mutation(handler) {
        const nextConfig: ProcedureConfig<Ctx, TEnrich, TLocalMeta> = {
          ...config,
          type: "mutation",
        };
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
        const resolvedFn = this.resolve(exec, nextConfig);

        const terminal = async function (this: any, ...args: any[]) {
          // Call the resolved function to get the tuple with this context
          const [result, error] = await resolvedFn.apply(this, args);

          // Handle redirect response
          if (error) {
            parseFrameworkError(error);
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
        const nextConfig: ProcedureConfig<Ctx, TEnrich, TLocalMeta> = {
          ...config,
          type: "query",
        };
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

        if (config.cache?.enabled && config.cache.options) {
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
        const resolvedFn = this.resolve(exec, nextConfig);

        const terminal = async function (this: any, ...args: any[]) {
          // Call the resolved function to get the tuple with this context
          const [result, error] = await resolvedFn.apply(this, args);

          // Handle redirect response
          if (error) {
            parseFrameworkError(error);
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

      webRoute(handler) {
        return webRouter(
          handler,
          resolvedOpts,
          config,
          globalCache,
          globalPubSub,
          globalCompressor,
        ) as any;
      },

      //@ts-ignore
      sse(handler) {
        const nextConfig: ProcedureConfig<Ctx, TEnrich, TLocalMeta> = {
          ...config,
          type: "sse",
        };
        //@ts-ignore
        const resolvedFn = this.resolve(handler, nextConfig);

        const terminal = async function* (...args: any[]) {
          const [result, error] = await resolvedFn(...args);
          if (error) {
            parseFrameworkError(error);
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
      ws(handler) {
        const nextConfig = { ...config, type: "ws" };

        const terminal = function (payload?: any, ...args: any[]) {
          return async (wsContext: {
            send: (event: any) => void;
            broadcast: (event: any) => void;
            onMessage: (cb: (data: any) => void) => void;
            onClose: (cb: (evt: CloseEvent) => void) => void;
            onError: (cb: (err: Event) => void) => void;
          }) => {
            const resolvedFn = handlerResolver(
              async ({ ctx, input }) => {
                //@ts-ignore
                return await handler({
                  ctx,
                  input,
                  send: wsContext.send,
                  broadcast: wsContext.broadcast ?? (() => {}),
                  onMessage: wsContext.onMessage,
                  onClose: wsContext.onClose,
                  onError: wsContext.onError,
                });
              },
              //@ts-ignore
              resolvedOpts,
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
    meta: resolvedOpts.meta,
    middlewares: resolvedOpts.middlewares as any,
    plugins: resolvedOpts.plugins as any,
    name: "unnamed",
    validationHint: resolvedOpts.validationHint ?? "Invalid data provided",
  });
}
