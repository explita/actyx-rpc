import type {
  SchemaResolver,
  ResolverResult,
  SchemaOrStandard,
} from "../../types/misc.js";
import type { StandardSchemaV1 } from "../../types/standard-schema.js";

function formatStandardPath(
  path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>,
): string {
  if (!path || path.length === 0) return "root";
  return path
    .map((segment) =>
      typeof segment === "object" && segment !== null && "key" in segment
        ? String((segment as any).key)
        : String(segment),
    )
    .join(".");
}

/**
 * Normalizes either a Standard Schema V1 instance or a classic SchemaResolver
 * into an internal SchemaResolver object.
 */
export function toSchemaResolver<T = any>(
  schemaOrResolver: SchemaOrStandard<T> | any,
): SchemaResolver<T> {
  if (
    schemaOrResolver &&
    (typeof schemaOrResolver === "object" ||
      typeof schemaOrResolver === "function") &&
    "~standard" in schemaOrResolver
  ) {
    const standard: StandardSchemaV1.Props<any, T> =
      schemaOrResolver["~standard"];

    return {
      async parse(data: Record<string, unknown>): Promise<ResolverResult<T>> {
        const result = await standard.validate(data);
        if (result.issues && result.issues.length > 0) {
          const errors: Record<string, string> = {};
          for (const issue of result.issues) {
            const key = formatStandardPath(issue.path);
            if (!errors[key]) {
              errors[key] = issue.message;
            }
          }
          return {
            success: false,
            errors,
            message: result.issues[0]?.message || "Validation failed",
          };
        }
        return {
          success: true,
          data: (result as StandardSchemaV1.SuccessResult<T>).value,
        };
      },
      toJsonSchema:
        typeof schemaOrResolver.toJsonSchema === "function"
          ? () => schemaOrResolver.toJsonSchema()
          : undefined,
    };
  }

  return schemaOrResolver as SchemaResolver<T>;
}
