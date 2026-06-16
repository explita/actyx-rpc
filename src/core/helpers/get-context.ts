import { rpcStorage } from "./rpc-storage.js";
import type { InferContext } from "../../types/procedure.js";

/**
 * Returns the current RPC context from `AsyncLocalStorage`.
 *
 * Must be called from within a procedure handler (or any function called by
 * one) — throws otherwise.
 *
 * Pass your procedure's `InferContext<typeof proc>` as the generic for full
 * type safety without manually threading the context through every call:
 *
 * @example
 * ```ts
 * // services/customer.ts
 * import { getContext, type InferContext } from "@explita/actyx-rpc";
 * import { procedure } from "../rpc";
 *
 * type Ctx = InferContext<typeof procedure>;
 *
 * export async function getAllCustomers() {
 *   const ctx = getContext<Ctx>();
 *   return db.customer.findMany({ where: { companyId: ctx.company.id } });
 * }
 * ```
 *
 * Prefer `procedure.context` when you have direct access to the procedure
 * instance — it is fully typed without any generic argument.
 */
export function getContext<T = any>(): T {
  const ctx = rpcStorage.getStore() as T | undefined;
  if (ctx === undefined) {
    throw new Error(
      "[Actyx RPC] No active procedure context found. " +
        "getContext() and procedure.context can only be used inside a handler (query, mutation, stream, or sse).",
    );
  }
  return ctx;
}
