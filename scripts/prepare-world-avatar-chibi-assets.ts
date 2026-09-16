import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceNames = {
  body: "sprite_de_personagem_chibi_careca.png",
  "hair-brown": "cabelo_castanho_pixelado_para_avatar_chibi.png",
  "hair-blue": "camada_de_cabelo_azul_marinho_em_pixel_art.png",
  "hair-blond": "sobreposição_de_cabelo_loiro_em_pixel_art.png",
  "top-red": "jaqueta_pixelada_de_treinador_vermelha.png",
  "top-white": "camiseta_branca_raglan_em_pixel_art.png",
  "top-black": "moletom_pixelado_preto_com_detalhes_vermelhos.png",
  "bottom-cargo": "calça_cargo_chumbo_em_pixel_art.png",
  "bottom-jeans": "calça_jeans_pixel_art_com_punhos_dobrados.png",
  shoes: "tênis_pixel_art_vermelho_e_preto.png",
} as const;

async function cleanAlpha(input: string) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) if (data[i] < 64) data[i] = 0;
  return sharp(data, { raw: info }).png().toBuffer();
}

async function placeCrop(
  buffer: Buffer,
  crop: { left: number; top: number; width: number; height: number },
  placement: { left: number; top: number; width: number; height: number },
) {
  const resized = await sharp(buffer).extract(crop).resize(placement.width, placement.height, {
    fit: "fill",
    kernel: sharp.kernel.nearest,
  }).png().toBuffer();
  return sharp({
    create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: resized, left: placement.left, top: placement.top }]).png().toBuffer();
}

async function main() {
  const source = path.resolve(process.argv[2] || ".asset-staging/world-avatar-chibi");
  const output = path.resolve(process.argv[3] || ".asset-staging/world-avatar-chibi-ready");
  await fs.mkdir(output, { recursive: true });
  const assets: Array<{ id: string; label: string; category: string; file: string; layer: number }> = [];
  const definitions = [
    ["body-chibi", "Corpo chibi", "body", "body", 1],
    ["bottom-cargo", "Calça cargo chumbo", "bottom", "bottom-cargo", 2],
    ["bottom-jeans", "Jeans com punhos", "bottom", "bottom-jeans", 2],
    ["shoes-red-black", "Tênis vermelho e preto", "shoes", "shoes", 3],
    ["top-red", "Jaqueta de treinador vermelha", "top", "top-red", 4],
    ["top-white", "Camiseta raglan branca", "top", "top-white", 4],
    ["top-black", "Moletom preto e vermelho", "top", "top-black", 4],
    ["hair-brown", "Cabelo castanho", "hair", "hair-brown", 5],
    ["hair-blue", "Cabelo azul-marinho", "hair", "hair-blue", 5],
    ["hair-blond", "Cabelo loiro", "hair", "hair-blond", 5],
  ] as const;
  for (const [id, label, category, sourceKey, layer] of definitions) {
    const input = path.join(source, sourceNames[sourceKey]);
    const file = `wm-avatar-chibi-${id}.png`;
    let buffer = await cleanAlpha(input);
    if (id === "hair-brown") {
      buffer = await sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: buffer, left: 0, top: -75 }]).png().toBuffer();
    }
    if (category === "hair") {
      const color = id === "hair-blue" ? "#243455" : id === "hair-blond" ? "#f2c863" : "#76503d";
      const scalp = Buffer.from(`<svg width="1024" height="1536" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="512" cy="235" rx="242" ry="132" fill="#2b1714"/>
        <ellipse cx="512" cy="238" rx="229" ry="119" fill="${color}"/>
      </svg>`);
      buffer = await sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: scalp }, { input: buffer }]).png().toBuffer();
    }
    if (id === "top-red") {
      buffer = await placeCrop(buffer,
        { left: 178, top: 585, width: 683, height: 505 },
        { left: 232, top: 615, width: 560, height: 414 });
    }
    if (id === "top-black") {
      buffer = await placeCrop(buffer,
        { left: 170, top: 601, width: 689, height: 511 },
        { left: 232, top: 615, width: 560, height: 415 });
    }
    if (id === "bottom-jeans") {
      buffer = await placeCrop(buffer,
        { left: 282, top: 655, width: 513, height: 610 },
        { left: 282, top: 775, width: 513, height: 610 });
    }
    if (id === "shoes-red-black") {
      buffer = await placeCrop(buffer,
        { left: 100, top: 588, width: 825, height: 539 },
        { left: 255, top: 1218, width: 515, height: 232 });
    }
    await fs.writeFile(path.join(output, file), buffer);
    assets.push({ id, label, category, file, layer });
  }
  await fs.writeFile(path.join(output, "manifest.json"), JSON.stringify({ version: 1, canvas: { width: 1024, height: 1536 }, colorSpace: "sRGB", assets }, null, 2));
  const first = (category: string) => assets.find((asset) => asset.category === category)!.file;
  await sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 5, g: 12, b: 22, alpha: 1 } } }).composite(["body", "bottom", "shoes", "top", "hair"].map((category) => ({ input: path.join(output, first(category)) }))).png().toFile(path.join(output, "preview.png"));
}

main().catch((error) => { console.error(error); process.exit(1); });
