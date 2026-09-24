import { createClient } from "@/dist/react";
import type { AppRouter } from "./router";

export const rpc = createClient<AppRouter>({
  baseUrl: "/api/rpc",
  batch: true,
});
