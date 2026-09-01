import { withCache } from "../cache/with-cache.js";
import { withCircuitBreaker } from "../circuit-breaker/with-circuit-breaker.js";
import { withCompression } from "../compression/with-compression.js";
import { withRetry } from "../retry/with-retry.js";
import { withTimeout } from "../timeout/with-timeout.js";
import { handlerResolver } from "./handler-resolver.js";
import type { CacheAdapter } from "../cache/types.js";
import type { PubSubAdapter } from "../../lib/pubsub.js";
import type { Compressor } from "../compression/compressor.js";
import { parseFrameworkError } from "../../lib/parse-framework-error.js";

export function webRouter(
  handler: any,
  opts: any,
  config: any,
  globalCache: CacheAdapter,
  globalPubSub: PubSubAdapter,
  globalCompressor: Compressor,
) {
  const nextConfig: any = { ...config, type: "webRoute" };
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
    exec = withCache(exec as any, globalCache, config.cache.options) as any;
  }

  if (nextConfig.circuitBreaker?.enabled) {
    exec = withCircuitBreaker(
      exec as any,
      nextConfig.circuitBreaker.state,
      nextConfig.circuitBreaker.options,
      nextConfig.name,
    ) as any;
  }

  const resolvedFn = handlerResolver(
    exec,
    opts,
    nextConfig,
    globalCache,
    globalPubSub,
  );

  const terminal = async function (req: Request, options: any) {
    try {
      const contentType = req.headers.get("content-type") || "";
      const url = new URL(req.url);
      const queryParams = Object.fromEntries(url.searchParams.entries());

      let bodyParams: any = {};
      if (req.method !== "GET" && req.method !== "HEAD") {
        if (
          !contentType.includes("application/json") &&
          !contentType.includes("multipart/form-data")
        ) {
          bodyParams = null;
        } else if (contentType.includes("multipart/form-data")) {
          const clonedReq = req.clone();
          const formData = await clonedReq.formData();
          const obj: any = {};
          formData.forEach((value, key) => {
            const parts = key.split(/[\[\]\.]/).filter(Boolean);
            let current = obj;
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              if (i === parts.length - 1) {
                if (current[part] !== undefined) {
                  if (Array.isArray(current[part])) {
                    current[part].push(value);
                  } else {
                    current[part] = [current[part], value];
                  }
                } else {
                  current[part] = value;
                }
              } else {
                current[part] = current[part] || {};
                current = current[part];
              }
            }
          });

          const convertNumericKeysToArrays = (val: any): any => {
            if (typeof val !== "object" || val === null) {
              return val;
            }
            if (
              val instanceof Blob ||
              val instanceof FormData ||
              (typeof File !== "undefined" && val instanceof File)
            ) {
              return val;
            }
            if (Array.isArray(val)) {
              return val.map(convertNumericKeysToArrays);
            }
            const processed: any = {};
            for (const [k, v] of Object.entries(val)) {
              processed[k] = convertNumericKeysToArrays(v);
            }
            const keys = Object.keys(processed);
            if (keys.length === 0) return processed;
            const isNumericArray = keys.every((k) => {
              const num = Number(k);
              return Number.isInteger(num) && num >= 0 && String(num) === k;
            });
            if (isNumericArray) {
              const maxIndex = Math.max(...keys.map(Number));
              const arr = new Array(maxIndex + 1);
              for (const [k, v] of Object.entries(processed)) {
                arr[Number(k)] = v;
              }
              return arr;
            }
            return processed;
          };

          bodyParams = convertNumericKeysToArrays(obj);
        } else {
          try {
            const clonedReq = req.clone();
            const body = await clonedReq.json();
            bodyParams = body.input !== undefined ? body.input : body;
          } catch {
            bodyParams = {};
          }
        }
      }

      let input: any;
      if (typeof bodyParams === "object" && bodyParams !== null) {
        input = {
          ...queryParams,
          ...bodyParams,
        };
      } else {
        input = bodyParams ?? queryParams;
      }

      // Merge dynamic parameters passed in options
      const params = options?.params;
      if (params && typeof input === "object" && input !== null) {
        input = {
          ...params,
          ...input,
        };
      }

      // Execute procedure resolver. Passing `req` and `options`
      const [result, error] = await resolvedFn(input, req, options);

      if (error) {
        parseFrameworkError(error);
        if ("_redirect" in error && typeof error._redirect === "function") {
          error._redirect();
        }
        delete error._redirect;

        const status = error.statusCode || 500;
        return new Response(JSON.stringify(error), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (result instanceof Response) {
        return result;
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      parseFrameworkError(err);

      return new Response(
        JSON.stringify({
          success: false,
          message: err.message || "Internal Server Error",
          reason: "UNEXPECTED_ERROR",
          statusCode: 500,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  };

  (terminal as any)._def = nextConfig;
  return terminal;
}
