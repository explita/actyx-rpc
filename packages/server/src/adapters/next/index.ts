import { nextAdapter } from "./next-headers.js";
export * from "./next-headers.js";

export function createRouteHandler(
  target: any,
) {
  return async function (req: Request, context: any): Promise<Response> {
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

    // If target is a single function and either no procedure query param is passed, or it is a webRoute, run directly
    if (typeof target === "function") {
      const procedureName = url.searchParams.get("procedure");
      if (!procedureName || target._def?.type === "webRoute" || !target._def) {
        return await target(req, options);
      }
    }

    const procedureName = url.searchParams.get("procedure");
    if (!procedureName) {
      return new Response(
        JSON.stringify({ message: "Procedure parameter required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const parts = procedureName.split(".");
    let current = target;
    for (const part of parts) {
      current = current?.[part];
    }

    if (!current || typeof current !== "function") {
      return new Response(
        JSON.stringify({ message: `Procedure ${procedureName} not found` }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    if (current._def?.type === "webRoute") {
      return await current(req, options);
    }

    // Parse input from searchParams or POST JSON body
    let input: any = undefined;
    if (req.method === "GET" || req.method === "HEAD") {
      const inputStr = url.searchParams.get("input");
      if (inputStr) {
        try {
          input = JSON.parse(inputStr);
        } catch {
          input = Object.fromEntries(url.searchParams.entries());
          delete input.procedure;
        }
      } else {
        input = Object.fromEntries(url.searchParams.entries());
        delete input.procedure;
      }
    } else {
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          const body = await req.json();
          input =
            body !== null && typeof body === "object" && "input" in body
              ? body.input
              : body;
        } catch {
          input = undefined;
        }
      }
    }

    if (current._def?.type === "sse") {
      const iterator = current(input, options);
      const { createSSEResponse } = await import("../../core/helpers/sse.js");
      return createSSEResponse(iterator);
    }

    if (current._def?.type === "stream") {
      const iterator = current(input, options);
      const { createSSEResponse } = await import("../../core/helpers/sse.js");
      async function* mapToSSE() {
        for await (const val of iterator) {
          yield { data: val };
        }
      }
      return createSSEResponse(mapToSSE());
    }

    const [result, error] = await current(input, options);
    if (error) {
      const status = error.statusCode || 500;
      return new Response(JSON.stringify(error), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}
