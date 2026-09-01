"use client";

import { createContext, useContext, ReactNode } from "react";
import { QueryClient } from "./lib/query-client.js";

const ActyxContext = createContext<QueryClient | undefined>(undefined);

export type ActyxProviderProps = {
  client: QueryClient;
  children: ReactNode;
};

export const ActyxProvider = ({ client, children }: ActyxProviderProps) => {
  return (
    <ActyxContext.Provider value={client}>{children}</ActyxContext.Provider>
  );
};

const defaultQueryClient = new QueryClient();

/**
 * Module-level reference set on every `useQueryClient()` call.
 * Allows non-hook code (e.g. SDK `invalidate`) to access the active
 * client without calling `useContext` outside render.
 */
let _cachedClient: QueryClient | undefined;

/**
 * Non-hook accessor — returns the QueryClient from the most recent
 * `useQueryClient()` call, or the default client as a fallback.
 */
export const getCachedQueryClient = (): QueryClient =>
  _cachedClient ?? defaultQueryClient;

export const useQueryClient = (): QueryClient => {
  const client = useContext(ActyxContext);
  const resolved = client ?? defaultQueryClient;
  _cachedClient = resolved;
  return resolved;
};
