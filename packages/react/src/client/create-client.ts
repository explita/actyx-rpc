import { createProxy } from "../lib/client-proxy.js";
import { ClientInstance, CreateClientOptions } from "../types/client.js";

export function createClient<TRouter>(
  options: CreateClientOptions,
): ClientInstance<TRouter> {
  if (!options || !options.baseUrl) {
    throw new Error(
      "createClient requires 'baseUrl' in options (e.g. createClient({ baseUrl: '/api/rpc' }))",
    );
  }

  return createProxy(options.baseUrl, options, []);
}
