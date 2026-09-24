import type { z } from "zod";
import type { SchemaResolver } from "../../types/misc.js";

/**
 * Wraps a Zod object or discriminated-union schema into a procedure resolver.
 *
 * Handles `FormData` and plain objects. Validation errors are returned
 * as a field-keyed `errors` map so the client can display them inline.
 *
 * @example
 * ```ts
 * import { z } from "zod";
 * import { zodResolver } from "@explita/actyx-rpc/resolvers/zod";
 *
 * const schema = z.object({ name: z.string().min(1) });
 * procedure.input(zodResolver(schema)).mutation(...)
 *
 * // Discriminated unions are also supported:
 * const schema = z.discriminatedUnion("type", [
 *   z.object({ type: z.literal("a"), value: z.string() }),
 *   z.object({ type: z.literal("b"), count: z.number() }),
 * ]);
 * ```
 */
export function zodResolver<
  S extends z.ZodObject<z.ZodRawShape> | z.ZodDiscriminatedUnion<any, any>,
>(
  schema: S,
  options?: z.core.ParseContext<z.core.$ZodIssue>,
): SchemaResolver<z.infer<S>> {
  const resolver: SchemaResolver<z.infer<S>> = {
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
      const unrepresentableHandler = (info: any) => {
        if (
          (typeof info?.message === "string" && info.message.includes("Date")) ||
          info?.type === "date"
        ) {
          return { type: "string", format: "date-time" };
        }
        return {};
      };

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
            try {
              properties[key] = v.toJSONSchema({
                unrepresentable: unrepresentableHandler,
              });
            } catch {
              try {
                properties[key] = v.toJSONSchema();
              } catch {
                properties[key] = {
                  type: typeName === "date" ? "string" : "object",
                  format: typeName === "date" ? "date-time" : undefined,
                };
              }
            }
          } else {
            properties[key] = {
              type:
                typeName === "number"
                  ? "number"
                  : typeName === "boolean"
                    ? "boolean"
                    : typeName === "array"
                      ? "array"
                      : typeName === "date"
                        ? "string"
                        : typeName === "object"
                          ? "object"
                          : "string",
              format: typeName === "date" ? "date-time" : undefined,
            };
          }

          if (typeof v.isOptional === "function" ? !v.isOptional() : true) {
            required.push(key);
          }
        }

        return {
          type: "object",
          properties,
          required: required.length > 0 ? required : undefined,
        };
      }

      if (typeof (schema as any).toJSONSchema === "function") {
        try {
          return (schema as any).toJSONSchema({
            unrepresentable: unrepresentableHandler,
          });
        } catch {
          try {
            return (schema as any).toJSONSchema();
          } catch {}
        }
      }

      return { type: "object" };
    },
  };

  (resolver as any)._def = { schema };

  return resolver;
}
