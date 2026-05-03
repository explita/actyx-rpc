import type { z } from "zod";
import type { SchemaResolver } from "../../types/misc.js";

/**
 * Wraps a Zod object schema into a procedure resolver.
 *
 * Handles `FormData` and plain objects. Validation errors are returned
 * as a field-keyed `errors` map so the client can display them inline.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { zodResolver } from "@explita/actyx-rpc/resolver/zod";
 *
 * const schema = z.object({ name: z.string().min(1) });
 * procedure.input(zodResolver(schema)).mutation(...)
 * ```
 */
export function zodResolver<S extends z.ZodType>(
  schema: S,
  options?: z.core.ParseContext<z.core.$ZodIssue>,
): SchemaResolver<z.infer<S>> {
  return {
    async parse(data) {
      const result = await schema.safeParseAsync(data, options);
      if (!result.success) {
        const errors = result.error.issues.reduce(
          (acc, item) => {
            acc[item.path.join(".") || "root"] = item.message;
            return acc;
          },
          {} as Record<string, string>,
        );
        return {
          success: false,
          errors,
        };
      }

      return result;
    },
    toJsonSchema() {
      const def = (schema as any)._def;
      const shape = (schema as any).shape || def?.shape;

      if (shape && typeof shape === "object") {
        const properties: Record<string, any> = {};
        const required: string[] = [];

        for (const [key, value] of Object.entries(shape)) {
          const v = value as any;
          // Check multiple possible locations for the type name
          const typeName = (v.type || v.def?.type || v._def?.typeName || "")
            .replace("Zod", "")
            .toLowerCase();

          // If the object already has a toJSONSchema method, use it!
          if (typeof v.toJSONSchema === "function") {
            properties[key] = v.toJSONSchema();
          } else {
            properties[key] = {
              type:
                typeName === "number"
                  ? "number"
                  : typeName === "boolean"
                    ? "boolean"
                    : typeName === "array"
                      ? "array"
                      : typeName === "object"
                        ? "object"
                        : "string",
            };
          }

          if (!v.isOptional()) {
            required.push(key);
          }
        }

        return {
          type: "object",
          properties,
          required: required.length > 0 ? required : undefined,
        };
      }
      return { type: "object" };
    },
  };
}
