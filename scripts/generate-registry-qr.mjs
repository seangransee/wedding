/*
 * Regenerate committed Venmo and Zelle receiving QR assets from registry.json.
 * Current state: Venmo profile verified in the signed-in browser; Zelle URL
 * decoded from Schwab's phone-number receiving QR on 2026-10-01. Both links
 * contain public receiving details only, without amounts or bank credentials.
 * Run npm run registry:generate after changing a verified receiving URL.
 * Post-run notes: the initial SVGs were decoded back to their source URLs.
 */
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const root = fileURLToPath(new URL("../", import.meta.url));
const registry = JSON.parse(await readFile(path.join(root, "src/lib/registry.json"), "utf8"));

for (const service of ["venmo", "zelle"]) {
  const { url, qrImage } = registry[service];
  const destination = path.join(root, "public", qrImage);
  await mkdir(path.dirname(destination), { recursive: true });
  await QRCode.toFile(destination, url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 4,
    width: 400,
    color: { dark: "#000000", light: "#ffffff" },
  });
  console.log(`Generated ${service} receiving QR`);
}
