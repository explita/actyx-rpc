import * as v from "valibot";
import type { SchemaResolver } from "../../types/misc.js";

/**
 * Wraps a Valibot object schema into a procedure resolver.
 *
 * Handles `FormData` and plain objects. Validation errors are returned
 * as a field-keyed `errors` map so the client can display them inline.
 *
 * @example
 * ```ts
 * import * as v from "valibot";
 * import { valibotResolver } from "@explita/actyx-rpc/resolvers/valibot";
 *
 * const schema = v.object({ name: v.string() });
 * procedure.input(valibotResolver(schema)).mutation(...)
 * ```
 */
export function valibotResolver<S extends v.ObjectSchema<any, any>>(
  schema: S,
  options?: v.Config<v.InferIssue<S>>,
): SchemaResolver<v.InferOutput<S>> {
  return {
    async parse(data) {
      const result = await v.safeParseAsync(schema, data, {
        abortEarly: false,
        ...options,
      });
      if (!result.success) {
        const errors = result.issues.reduce(
          (acc, item) => {
            acc[item.path?.map((p: any) => String(p.key)).join(".") || "root"] =
              item.message;
            return acc;
          },
          {} as Record<string, string>,
        );
        return {
          success: false,
          errors,
        };
      }

      return { success: true, data: result.output };
    },
    toJsonSchema() {
      if (typeof (schema as any).toJSONSchema === "function")
        return (schema as any).toJSONSchema();

      // Basic introspection for Valibot objects
      if (schema.type === "object" && (schema as any).entries) {
        const properties: Record<string, any> = {};

        for (const [key, value] of Object.entries((schema as any).entries)) {
          const v = value as any;
          properties[key] = {
            type:
              v.type === "number"
                ? "number"
                : v.type === "boolean"
                  ? "boolean"
                  : "string",
          };
          // Valibot marks optional/null in its own way, simplified here
        }

        return { type: "object", properties };
      }

      return { type: "object" };
    },
  };
}
