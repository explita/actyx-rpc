import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const src = path.join(__dirname, "../dist");
const dest = path.join(__dirname, "../examples/src/dist");

try {
  // Remove existing dest directory if it exists
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }

  // Copy recursively
  fs.cpSync(src, dest, { recursive: true });
  console.log("Successfully copied dist to examples/src/dist");
} catch (err) {
  console.error("Error copying dist to examples/src/dist:", err);
  process.exit(1);
}
