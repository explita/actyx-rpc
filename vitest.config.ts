import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: {
      "react": path.resolve(__dirname, "examples/node_modules/react"),
      "react-dom": path.resolve(__dirname, "examples/node_modules/react-dom"),
    },
  },
});
