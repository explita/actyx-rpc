import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverDist = path.join(__dirname, "../packages/server/dist");
const reactDist = path.join(__dirname, "../packages/react/dist");
const dest = path.join(__dirname, "../examples/src/dist");

try {
  if (fs.existsSync(path.dirname(dest))) {
    // 1. Clean destination directory
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true });
    }
    fs.mkdirSync(dest, { recursive: true });

    // 2. Copy server dist into examples/src/dist
    if (fs.existsSync(serverDist)) {
      fs.cpSync(serverDist, dest, { recursive: true });
      console.log(
        "Successfully copied @explita/actyx-rpc dist to examples/src/dist",
      );
    } else {
      console.warn(
        "Warning: @explita/actyx-rpc dist not found at " + serverDist,
      );
    }

    // 3. Copy react dist into examples/src/dist/react and examples/src/dist/client
    if (fs.existsSync(reactDist)) {
      const reactDest = path.join(dest, "react");
      fs.cpSync(reactDist, reactDest, { recursive: true });

      console.log(
        "Successfully copied @explita/actyx-rpc-react dist to examples/src/dist/react",
      );
    } else {
      console.warn(
        "Warning: @explita/actyx-rpc-react dist not found at " + reactDist,
      );
    }
  }
} catch (err) {
  console.error("Error copying dist to examples/src/dist:", err);
  process.exit(1);
}
