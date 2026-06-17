import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = path.join(__dirname, "../node_modules/nextra-theme-docs/dist/schemas.js");

if (fs.existsSync(targetFile)) {
  try {
    let content = fs.readFileSync(targetFile, "utf8");
    if (content.includes("children: reactNode,")) {
      content = content.replace("children: reactNode,", "children: reactNode.optional(),");
      fs.writeFileSync(targetFile, content, "utf8");
      console.log("Successfully patched nextra-theme-docs schemas.js: marked children as optional.");
    } else {
      console.log("nextra-theme-docs schemas.js is already patched or format has changed.");
    }
  } catch (err) {
    console.error("Failed to patch nextra-theme-docs schemas.js:", err);
  }
} else {
  console.warn("Could not find nextra-theme-docs schemas.js to patch at:", targetFile);
}
