"use client";

import { createContext, useContext, ReactNode } from "react";
import { QueryClient } from "./lib/query-client.js";

export const ActyxContext = createContext<QueryClient | undefined>(undefined);

export type ActyxProviderProps = {
  client: QueryClient;
  children: ReactNode;
};

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

export const useQueryClient = (explicitClient?: QueryClient): QueryClient => {
  const client = useContext(ActyxContext);
  const resolved = explicitClient ?? client ?? _cachedClient ?? defaultQueryClient;
  if (resolved !== defaultQueryClient) {
    _cachedClient = resolved;
  }
  return resolved;
};
