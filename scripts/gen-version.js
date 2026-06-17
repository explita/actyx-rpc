import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const pkgPath = path.join(__dirname, "../package.json");
  const outPath = path.join(__dirname, "../src/version.ts");

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  fs.writeFileSync(outPath, `export const VERSION = "${pkg.version}";\n`);
  console.log(`Generated src/version.ts with version ${pkg.version}`);
} catch (error) {
  console.log(error.message);
}
