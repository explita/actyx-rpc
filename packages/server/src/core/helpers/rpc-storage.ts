import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Global storage that holds the current RPC context for the duration of a
 * procedure call (and any nested calls it makes).  Populated by
 * `handlerResolver` before invoking the handler.
 *
 * @internal – consume via `getContext()` or `procedure.context` instead.
 */
export const rpcStorage = new AsyncLocalStorage<any>();
