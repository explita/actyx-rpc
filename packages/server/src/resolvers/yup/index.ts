import * as yup from "yup";
import type { SchemaResolver } from "../../types/misc.js";

/**
 * Wraps a Yup object schema into a procedure resolver.
 *
 * Handles `FormData` and plain objects. Validation errors are returned
 * as a field-keyed `errors` map so the client can display them inline.
 *
 * @example
 * ```ts
 * import * as yup from "yup";
 * import { yupResolver } from "@explita/actyx-rpc/resolvers/yup";
 *
 * const schema = yup.object({ name: yup.string().min(1) });
 * procedure.input(yupResolver(schema)).mutation(...)
 * ```
 */
export function yupResolver<S extends yup.ObjectSchema<any>>(
  schema: S,
  options?: yup.ValidateOptions,
): SchemaResolver<yup.InferType<S>> {
  return {
    async parse(data: unknown) {
      try {
        // Validate and return typed data
        const validatedData = await schema.validate(data, {
          abortEarly: false, // Return all validation errors
          stripUnknown: true, // Remove unknown properties
          ...options,
        });

        return { success: true, data: validatedData };
      } catch (error) {
        if (error instanceof yup.ValidationError) {
          // Format Yup validation errors
          const errors = error.inner.reduce(
            (acc, err) => {
              if (err.path) {
                acc[err.path || "root"] = err.message;
              }
              return acc;
            },
            {} as Record<string, string>,
          );

          return { success: false, errors };
        }
        throw error;
      }
    },
    toJsonSchema() {
      if (typeof (schema as any).toJSONSchema === "function")
        return (schema as any).toJSONSchema();

      const description = schema.describe();
      if (description.type === "object") {
        const properties: Record<string, any> = {};
        for (const [key, value] of Object.entries(
          (description as any).fields || {},
        )) {
          properties[key] = { type: (value as any).type };
        }
        return { type: "object", properties };
      }
      return { type: description.type };
    },
  };
}
