import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    environment: "jsdom",
  },
  resolve: {
    alias: {
      "@explita/actyx-rpc": path.resolve(__dirname, "packages/server/src"),
      "@explita/actyx-rpc-react": path.resolve(__dirname, "packages/react/src"),
    },
  },
});
