import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Global storage that holds the current RPC context for the duration of a
 * procedure call (and any nested calls it makes).  Populated by
 * `handlerResolver` before invoking the handler.
 *
 * @internal – consume via `getContext()` or `procedure.context` instead.
 */
export const rpcStorage = new AsyncLocalStorage<any>();

export type HttpContext = {
  req?: Request;
  context?: any;
};

/**
 * Ambient storage that holds the incoming HTTP Request and route context for
 * the duration of a request dispatched by adapters (e.g. Next.js route handlers).
 */
export const httpStorage = new AsyncLocalStorage<HttpContext>();

/**
 * Access the incoming HTTP Request and route context anywhere in the RPC call stack.
 */
export function getHttpContext(): HttpContext | undefined {
  return httpStorage.getStore();
}

/**
 * Access the incoming Web standard Request object if called within an HTTP context.
 */
export function getRequest(): Request | undefined {
  return httpStorage.getStore()?.req;
}

