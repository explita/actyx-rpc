import Joi from "joi";
import type { SchemaResolver } from "../../types/misc.js";

type JoiInfer<T> = T extends Joi.Schema<infer U> ? U : never;

/**
 * Wraps a Yup object schema into a procedure resolver.
 *
 * Handles `FormData` and plain objects. Validation errors are returned
 * as a field-keyed `errors` map so the client can display them inline.
 *
 * @example
 * ```ts
 * import Joi from 'joi';
 * import { yupResolver } from "@explita/actyx-rpc/resolver/yup";
 *
 * const schema = yup.object({ name: yup.string().min(1) });
 * procedure.input(yupResolver(schema)).mutation(...)
 * ```
 */
export function joiResolver<
  T extends Record<string, unknown>,
  S extends Joi.Schema<any> = Joi.Schema<T>,
>(schema: S, options?: Joi.ValidationOptions): SchemaResolver<T> {
  return {
    async parse(data: unknown) {
      try {
        const value = await schema.validateAsync(data, {
          abortEarly: false, // Return all errors
          stripUnknown: true, // Remove unknown properties
          convert: true, // Convert types (e.g., "1" to 1)
          ...options,
        });

        return {
          success: true,
          data: value,
        };
      } catch (error) {
        // Format Joi validation errors
        if (error instanceof Joi.ValidationError) {
          const errors = error.details.reduce(
            (acc, detail) => {
              const path = detail.path.join(".") || "root";
              acc[path] = detail.message;
              return acc;
            },
            {} as Record<string, string>,
          );

          return { success: false, errors };
        }

        throw error;
      }
    },
  };
}
