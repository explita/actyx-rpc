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
 * import { valibotResolver } from "@explita/actyx-rpc/resolver/valibot";
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
      const result = v.safeParse(schema, data, {
        abortEarly: false,
        ...options,
      });
      if (!result.success) {
        const errors = result.issues.reduce(
          (acc, item) => {
            acc[item.path?.map((p: any) => String(p.key)).join(".") ?? "root"] =
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
  };
}
