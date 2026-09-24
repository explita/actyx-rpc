import { nextAdapter } from "./next-headers.js";
import { httpStorage } from "../../core/helpers/rpc-storage.js";
import { resolveProcedure } from "./procedure-resolver.js";
import { parseRequestBody } from "./body-parser.js";
import { createBatchHandler } from "../../core/batch/handler.js";

export type NextRouteHandlerFn = (
  req: Request,
  context?: any,
) => Promise<Response>;

export type NextRouteHandler = NextRouteHandlerFn & {
  GET: NextRouteHandlerFn;
  POST: NextRouteHandlerFn;
  PUT: NextRouteHandlerFn;
  PATCH: NextRouteHandlerFn;
  DELETE: NextRouteHandlerFn;
  HEAD: NextRouteHandlerFn;
  OPTIONS: NextRouteHandlerFn;
};

export function createHandler<T extends Record<string, any>>(
  target: T,
): NextRouteHandler {
  const batchHandler = createBatchHandler(target);

  const handleOptions: NextRouteHandlerFn = async () => {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
      },
    });
  };

  const handler = async function (
    req: Request,
    context: any,
  ): Promise<Response> {
    if (req.method === "OPTIONS") {
      return handleOptions(req, context);
    }

    const params = context?.params ? await context.params : undefined;
    const nextInfo = await nextAdapter();
    const { headers: h, cookies: c, ...restNextInfo } = nextInfo;

    const options = { ...context, params, ...restNextInfo };

    Object.defineProperty(options, "headers", {
      value: h,
      enumerable: false,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(options, "cookies", {
      value: c,
      enumerable: false,
      writable: true,
      configurable: true,
    });

    const url = new URL(req.url);

    // Check for HTTP batch request (?batch=1 or header or /batch route)
    const isBatch =
      url.searchParams.get("batch") === "1" ||
      url.searchParams.has("batch") ||
      req.headers.get("x-actyx-batch") === "1" ||
      url.pathname.endsWith("/batch") ||
      (Array.isArray(params?.rpc) && params.rpc.length === 1 && params.rpc[0] === "batch") ||
      (typeof params?.rpc === "string" && params.rpc === "batch");

    if (isBatch && req.method === "POST") {
      let batchItems: any[];
      try {
        const cloned = req.clone();
        batchItems = await cloned.json();
      } catch {
        return Response.json(
          { message: "Invalid JSON body for batch request" },
          { status: 400 },
        );
      }

      if (!Array.isArray(batchItems)) {
        return Response.json(
          { message: "Batch request body must be an array" },
          { status: 400 },
        );
      }

      const httpScope = { req, context: options, options };

      const results = await httpStorage.run(httpScope, async () => {
        return await batchHandler(batchItems, httpScope);
      });

      return Response.json(results, { status: 200 });
    }

    // 1. Resolve procedure from route params, query, or pathname
    const procedureResult = resolveProcedure(url, params, target);
    if (!procedureResult.success) {
      return procedureResult.response;
    }

    const { procedure: current } = procedureResult;

    // 2. Parse input and extraArgs (cloning req before body consumption)
    const { input, extraArgs } = await parseRequestBody(req, url);

    const httpScope = { req, context: options, options };

    return await httpStorage.run(httpScope, async () => {
      if (current._def?.type === "webRoute") {
        return await current(req, options);
      }

      if (current._def?.type === "sse") {
        const iterator = current.call(httpScope, input, ...extraArgs);
        const { createSSEResponse } = await import("../../core/helpers/sse.js");
        return createSSEResponse(iterator);
      }

      if (current._def?.type === "stream") {
        const iterator = current.call(httpScope, input, ...extraArgs);
        const { createSSEResponse } = await import("../../core/helpers/sse.js");
        async function* mapToSSE() {
          for await (const val of iterator) {
            yield { data: val };
          }
        }
        return createSSEResponse(mapToSSE());
      }

      const [result, error] = await current.call(
        httpScope,
        input,
        ...extraArgs,
      );
      if (error) {
        const status = error.statusCode || 500;
        return Response.json(error, {
          status,
        });
      }

      return Response.json(result, { status: 200 });
    });
  } as unknown as NextRouteHandler;

  handler.GET = handler;
  handler.POST = handler;
  handler.PUT = handler;
  handler.PATCH = handler;
  handler.DELETE = handler;
  handler.HEAD = handler;
  handler.OPTIONS = handleOptions;

  return handler;
}
