import { type, type Type } from "arktype";
import type { SchemaResolver } from "../../types/misc.js";

/**
 * Wraps a ArkType object schema into a procedure resolver.
 *
 * Handles `FormData` and plain objects. Validation errors are returned
 * as a field-keyed `errors` map so the client can display them inline.
 *
 * @example
 * ```ts
 * import { type } from "arktype";
 * import { arktypeResolver } from "@explita/actyx-rpc/resolver/arktype";
 *
 * const schema = type({ name: "string > 1", description: "string?" });
 * procedure.input(arktypeResolver(schema)).mutation(...)
 * ```
 */
export function arktypeResolver<S extends Type<any, any>>(
  schema: S,
): SchemaResolver<type.infer<S>> {
  return {
    async parse(data) {
      const result = schema(data);

      if (result instanceof type.errors) {
        const errors = result.reduce(
          (acc, item) => {
            acc[item.path.join(".") || "root"] = item.message;
            return acc;
          },
          {} as Record<string, string>,
        );
        return { success: false, errors };
      }
      return { success: true, data: result };
    },
    toJsonSchema() {
      const s = schema as any;
      if (typeof s.toJSONSchema === "function") return s.toJSONSchema();

      const arkJson = s.json;
      if (arkJson && (arkJson.domain === "object" || arkJson.required || arkJson.optional)) {
        const properties: Record<string, any> = {};
        const required: string[] = [];

        // Map required properties
        if (Array.isArray(arkJson.required)) {
          for (const prop of arkJson.required) {
            properties[prop.key] = {
              type: typeof prop.value === "string" ? prop.value : "string",
            };
            required.push(prop.key);
          }
        }

        // Map optional properties
        if (Array.isArray(arkJson.optional)) {
          for (const prop of arkJson.optional) {
            properties[prop.key] = {
              type: typeof prop.value === "string" ? prop.value : "string",
            };
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
