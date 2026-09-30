import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import nextEnv from '@next/env';
import { createClient } from '@supabase/supabase-js';

// Explicit paths only; preserve all originals. No overwrites in Storage.
nextEnv.loadEnvConfig(process.cwd());
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const inputs = process.argv.slice(2);
if (inputs.length !== 4) throw new Error('Usage: node scripts/upload-site-theme-assets.mjs logo alakazam mewtwo sudowoodo');
const outputDir = path.resolve('.asset-staging/site-themes');
await mkdir(outputDir, { recursive: true });
const manifest = {};
for (let index = 0; index < inputs.length; index++) {
  const id = ['logo', 'alakazam', 'mewtwo', 'sudowoodo'][index];
  const input = await readFile(inputs[index]);
  const variants = index === 0 ? [['logo', 600, 88]] : [['desktop', 1672, 82], ['mobile', 960, 78], ['thumbnail', 360, 72]];
  manifest[id] = {};
  for (const [variant, width, quality] of variants) {
    const output = await sharp(input).rotate().resize({ width, withoutEnlargement: true }).webp({ quality, alphaQuality: 100, effort: 6 }).toBuffer();
    const hash = createHash('sha256').update(output).digest('hex').slice(0, 12);
    const name = `${id}-${variant}-${hash}.webp`;
    await writeFile(path.join(outputDir, name), output);
    const storagePath = `site-themes/${name}`;
    const { error } = await client.storage.from('assets').upload(storagePath, output, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
    if (error && String(error.statusCode) !== '409' && !/already exists/i.test(error.message)) throw error;
    // HEAD checks public accessibility even when a content-addressed upload already exists.
    const url = client.storage.from('assets').getPublicUrl(storagePath).data.publicUrl;
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok || Number(response.headers.get('content-length')) !== output.length) throw new Error(`Invalid asset: ${name}`);
    manifest[id][variant] = url;
    console.log(JSON.stringify({ id, variant, originalBytes: input.length, bytes: output.length, url, cache: response.headers.get('cache-control') }));
  }
}
await writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
