import { NextResponse } from "next/server";
import type { ErrorResponse } from "../../types/misc.js";

/**
 * Creates a Next.js Route Handler for an Actyx RPC procedure.
 * This is useful for features that require standard HTTP requests, such as
 * real-time progress tracking which is not natively supported by Next.js Server Actions.
 *
 * @param handler The procedure function to execute.
 * @returns A POST handler function for Next.js Route Handlers.
 */
export function createNextHandler<TInput, TOutput>(
  handler: (
    input: TInput,
    ...args: any[]
  ) => Promise<[TOutput, null] | [null, ErrorResponse]>,
) {
  return async function POST(req: Request) {
    try {
      const contentType = req.headers.get("content-type") || "";
      let input: TInput | undefined;

      if (
        !contentType.includes("application/json") &&
        !contentType.includes("multipart/form-data")
      ) {
        // Raw binary request - pass the stream directly as the input
        input = req.body as unknown as TInput;
      }

      if (input === undefined) {
        if (contentType.includes("multipart/form-data")) {
          const formData = await req.formData();
          const obj: any = {};
          formData.forEach((value, key) => {
            const parts = key.split(/[\[\]\.]/).filter(Boolean);
            let current = obj;
            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              if (i === parts.length - 1) {
                current[part] = value;
              } else {
                current[part] = current[part] || {};
                current = current[part];
              }
            }
          });
          input = obj as TInput;
        } else {
          try {
            const body = await req.json();
            input = (body.input !== undefined ? body.input : body) as TInput;
          } catch (e) {
            // Fallback for empty bodies or non-json
            input = {} as TInput;
          }
        }
      }

      // Execute the handler
      const isBinary =
        !contentType.includes("application/json") &&
        !contentType.includes("multipart/form-data");

      const [result, error] = isBinary
        ? await handler(req.body as unknown as TInput)
        : await handler(input as TInput);

      if (error) {
        return NextResponse.json(error, { status: error.statusCode || 500 });
      }

      return NextResponse.json({ success: true, data: result });
    } catch (err: any) {
      return NextResponse.json(
        {
          success: false,
          message: err.message || "Internal Server Error",
          reason: "UNEXPECTED_ERROR",
          statusCode: 500,
        },
        { status: 500 },
      );
    }
  };
}
