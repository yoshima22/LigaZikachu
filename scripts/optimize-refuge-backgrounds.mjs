import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const base = "https://fwxqywivezsixamietps.supabase.co/storage/v1/object/public/assets/Lacos/";
await mkdir("public/refuge", { recursive: true });
for (const name of ["CampoDeTreinoLacos", "DescansoLacos", "HortaLacos", "PatioLacos"]) {
  const response = await fetch(`${base}${name}.png`);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const input = Buffer.from(await response.arrayBuffer());
  const { width, height } = await sharp(input).metadata();
  const output = await sharp(input).webp({ quality: 82, effort: 6 }).toBuffer();
  const hash = createHash("sha256").update(output).digest("hex").slice(0, 12);
  const path = `public/refuge/${name}-${hash}.webp`;
  await writeFile(path, output);
  console.log(JSON.stringify({ source: `${base}${name}.png`, path: `/${path.slice(7)}`, width, height, before: input.length, after: output.length }));
}
