"use client";

import { createContext, useContext, ReactNode } from "react";
import { QueryClient } from "./lib/query-client.js";

/**
 * React context holding the active `QueryClient` instance.
 * Consumed internally by all Actyx RPC hooks via `useQueryClient()`.
 */
export const ActyxContext = createContext<QueryClient | undefined>(undefined);

/**
 * Props for the {@link ActyxProvider} component.
 */
export type ActyxProviderProps = {
  /** The `QueryClient` instance that manages query/mutation caching for all descendant hooks. */
  client: QueryClient;
  /** React children to render within the provider. */
  children: ReactNode;
};

/**
 * React context provider that supplies a `QueryClient` to all descendant Actyx RPC hooks.
 *
 * Wrap your application (or a subtree) with this component to share a single
 * `QueryClient` instance across `useQuery`, `useMutation`, and all other hooks.
 *
 * @example
 * ```tsx
 * const queryClient = new QueryClient();
 *
 * function App() {
 *   return (
 *     <ActyxProvider client={queryClient}>
 *       <MyRoutes />
 *     </ActyxProvider>
 *   );
 * }
 * ```
 */
export const ActyxProvider = ({ client, children }: ActyxProviderProps) => {
  _cachedClient = client;
  return (
    <ActyxContext.Provider value={client}>{children}</ActyxContext.Provider>
  );
};

const defaultQueryClient = new QueryClient();

/**
 * Module-level reference set on every `useQueryClient()` call or ActyxProvider render.
 * Allows non-hook code (e.g. SDK `invalidate` or DevTools) to access the active
 * client without calling `useContext` outside render.
 */
let _cachedClient: QueryClient | undefined;

/**
 * Non-hook accessor — returns the QueryClient from the most recent
 * `useQueryClient()` or `ActyxProvider` call, or the default client as a fallback.
 */
export const getCachedQueryClient = (): QueryClient =>
  _cachedClient ?? defaultQueryClient;

/**
 * React hook that returns the active `QueryClient` instance.
 *
 * Resolution order:
 * 1. `explicitClient` argument (if provided).
 * 2. Nearest `ActyxProvider` context value.
 * 3. Module-level cached client (set by prior calls or provider renders).
 * 4. Built-in default `QueryClient` as a last resort.
 *
 * @param explicitClient - Optional explicit `QueryClient` to use instead of the contextual one.
 * @returns The resolved `QueryClient` instance.
 */
export const useQueryClient = (explicitClient?: QueryClient): QueryClient => {
  const client = useContext(ActyxContext);
  const resolved = explicitClient ?? client ?? _cachedClient ?? defaultQueryClient;
  if (resolved !== defaultQueryClient) {
    _cachedClient = resolved;
  }
  return resolved;
};
