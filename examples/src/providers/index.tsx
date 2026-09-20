"use client";

import { ActyxProvider, QueryClient } from "@/dist/react";
import { useState, ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queries: {
          staleTime: "5m",
        },
      }),
  );

  return <ActyxProvider client={queryClient}>{children}</ActyxProvider>;
}
