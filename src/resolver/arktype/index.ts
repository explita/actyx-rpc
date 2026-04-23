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
            acc[item.path.join(".")] = item.message;
            return acc;
          },
          {} as Record<string, string>,
        );
        return { success: false, errors };
      }
      return { success: true, data: result };
    },
  };
}
