import type { ResolverResult, SchemaResolver } from "../types/misc.js";

/**
 * Generic resolver factory — the escape hatch for any validation library
 * (ArkType, custom, etc.).
 *
 * You provide a function that receives the raw payload and returns a
 * `ResolverResult<T>` — either `{ success: true, data }` or
 * `{ success: false, errors }`. The procedure engine takes it from there.
 *
 * @example ArkType
 * ```ts
 * import { type } from "arktype";
 * import { resolver } from "@explita/actyx-rpc/resolver";
 *
 * const schema = type({ name: "string" });
 *
 * procedure.input(
 *   resolver<typeof schema.infer>((data) => {
 *     const result = schema(data);
 *     if (result instanceof type.errors)
 *       return { success: false, errors: { root: result.summary } };
 *     return { success: true, data: result };
 *   }),
 * ).mutation(...)
 * ```
 */
export function resolver<T>(
  parseFn: (
    data: Record<string, unknown>,
  ) => Promise<ResolverResult<T>> | ResolverResult<T>,
): SchemaResolver<T> {
  return { parse: parseFn };
}
