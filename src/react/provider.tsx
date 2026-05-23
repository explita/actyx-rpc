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

export const useQueryClient = (): QueryClient => {
  const client = useContext(ActyxContext);

  if (!client) {
    console.warn(
      "No ActyxProvider found. Make sure to wrap your application in an <ActyxProvider client={queryClient}>",
    );
    return defaultQueryClient;
  }

  return client;
};
