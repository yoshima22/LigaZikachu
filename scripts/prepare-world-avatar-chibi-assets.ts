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
    if (id === "shoes-red-black") {
      // A arte recebida está centralizada no tórax. Recorta o conteúdo, reduz e
      // ancora a dupla de tênis na linha dos pés do corpo-base.
      const cropped = await sharp(buffer).extract({ left: 100, top: 588, width: 825, height: 539 }).resize(520, 340, { fit: "fill" }).png().toBuffer();
      buffer = await sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: cropped, left: 252, top: 1120 }]).png().toBuffer();
    }
    await fs.writeFile(path.join(output, file), buffer);
    assets.push({ id, label, category, file, layer });
  }
  await fs.writeFile(path.join(output, "manifest.json"), JSON.stringify({ version: 1, canvas: { width: 1024, height: 1536 }, colorSpace: "sRGB", assets }, null, 2));
  const first = (category: string) => assets.find((asset) => asset.category === category)!.file;
  await sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 5, g: 12, b: 22, alpha: 1 } } }).composite(["body", "bottom", "shoes", "top", "hair"].map((category) => ({ input: path.join(output, first(category)) }))).png().toFile(path.join(output, "preview.png"));
}

main().catch((error) => { console.error(error); process.exit(1); });
