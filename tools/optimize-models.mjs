/**
 * GLB pipeline (D1): assets-src/models/<slug>/<slug>.glb (+ .mobile.glb) → public/models/<slug>/.
 *
 *   node tools/optimize-models.mjs            every model with a source folder
 *   node tools/optimize-models.mjs sook       one model
 *
 * Per file: dedup, prune, weld, resize textures (per-object sizes below: desktop max 2048, mobile
 * max 1024), KTX2 (UASTC for base colour / emissive artwork, ETC1S for ORM and normal maps, mipmaps,
 * Zstandard), then meshopt geometry compression. Prints the final size and triangle count of each
 * output; writes tools/models-report.json for the delivery report.
 *
 * KTX2 is encoded with ktx2-encoder (Basis Universal compiled to WASM), not the toktx CLI, so the
 * pipeline runs anywhere npm does.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, textureCompress, weld } from '@gltf-transform/functions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Texture sizes per object. Artwork is capped where the source art (or the object's size in the
 * booth) carries no more detail: Too Yumm's label art is 611px (README), SOOK boxes are 95mm,
 * SHUNYA pieces are 3 to 23cm. The JSW book is half a metre wide and the tray hero: full 2048.
 */
const SIZES = {
  'too-yumm': { desktop: { art: 1024, data: 512 }, mobile: { art: 512, data: 512 } },
  sook: { desktop: { art: 1024, data: 512 }, mobile: { art: 512, data: 256 } },
  // rebuilt in batch 07 (A1): its source embeds JPEG art, so UASTC at 2048 would double it; 1536 keeps it ≤ 1.5MB
  'jsw-sports': { desktop: { art: 1536, data: 512 }, mobile: { art: 768, data: 256 } },
  shunya: { desktop: { art: 1024, data: 512 }, mobile: { art: 512, data: 256 } },
  // batch 07 (A1): the devices, the tug and the Bengal set. Every desktop file ≤ 1.5MB, mobile ≤ 600KB.
  mitooshi: { desktop: { art: 1024, data: 1024 }, mobile: { art: 512, data: 512 } },
  'house-of-hex': { desktop: { art: 1024, data: 512 }, mobile: { art: 512, data: 256 } },
  sonde: { desktop: { art: 1024, data: 512 }, mobile: { art: 512, data: 256 } },
  'indo-thai': { desktop: { art: 1024, data: 512 }, mobile: { art: 512, data: 256 } },
  'bengal-t20': { desktop: { art: 1024, data: 512 }, mobile: { art: 512, data: 256 } },
};

/** RGBA raster for the Basis encoder (it takes raw pixels in Node). */
const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
};

const ART = /baseColor|emissive|diffuse/i;
const NORMAL = /normal/i;
const DATA = /occlusion|metallicRoughness|clearcoat|sheen|specular|transmission|thickness/i;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

function triangles(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) {
      const idx = p.getIndices();
      n += Math.round((idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3);
    }
  return n;
}

async function build(slug, tier) {
  const srcName = tier === 'mobile' ? `${slug}.mobile.glb` : `${slug}.glb`;
  const src = join(ROOT, 'assets-src/models', slug, srcName);
  if (!existsSync(src)) return null;
  const size = SIZES[slug]?.[tier] ?? { art: tier === 'mobile' ? 512 : 1024, data: 512 };
  const doc = await io.read(src);
  const inTris = triangles(doc);
  await doc.transform(
    dedup(),
    prune({ keepAttributes: true }), // A3: the screen mesh has no texture in the file, but its UV0 maps the logo
    weld(),
    textureCompress({ encoder: sharp, targetFormat: 'png', resize: [size.art, size.art], slots: ART }),
    textureCompress({ encoder: sharp, targetFormat: 'png', resize: [size.data, size.data], slots: new RegExp(`${NORMAL.source}|${DATA.source}`, 'i') }),
    // artwork: UASTC, sRGB, RDO for size, Zstandard
    ktx2({ slots: ART, isUASTC: true, uastcLDRQualityLevel: 2, enableRDO: true, rdoQualityLevel: 1.5, needSupercompression: true, isSetKTX2SRGBTransferFunc: true, generateMipmap: true, isKTX2File: true, imageDecoder }),
    // normal maps: ETC1S tuned for normals, linear
    ktx2({ slots: NORMAL, isUASTC: false, isNormalMap: true, qualityLevel: 230, compressionLevel: 2, isSetKTX2SRGBTransferFunc: false, isPerceptual: false, generateMipmap: true, isKTX2File: true, imageDecoder }),
    // ORM and other data maps: ETC1S, linear
    ktx2({ slots: DATA, isUASTC: false, qualityLevel: 200, compressionLevel: 2, isSetKTX2SRGBTransferFunc: false, isPerceptual: false, generateMipmap: true, isKTX2File: true, imageDecoder }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const outDir = join(ROOT, 'public/models', slug);
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, srcName);
  await io.write(out, doc);
  const textures = doc
    .getRoot()
    .listTextures()
    .map((t) => ({ name: t.getName() || t.getURI(), mime: t.getMimeType(), kb: Math.round((t.getImage()?.byteLength ?? 0) / 1024) }));
  return { file: `public/models/${slug}/${srcName}`, sourceMB: +(statSync(src).size / 1048576).toFixed(2), MB: +(statSync(out).size / 1048576).toFixed(2), triangles: triangles(doc), sourceTriangles: inTris, art: size.art, data: size.data, textures };
}

const only = process.argv.slice(2);
const slugs = Object.keys(SIZES).filter((s) => !only.length || only.includes(s));
const reportPath = join(ROOT, 'tools/models-report.json');
const report = existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, 'utf8')) : {};
for (const slug of slugs) {
  for (const tier of ['desktop', 'mobile']) {
    const t0 = Date.now();
    const r = await build(slug, tier);
    if (!r) {
      console.log(`${slug} ${tier}: no source, skipped`);
      continue;
    }
    report[`${slug}/${tier}`] = r;
    console.log(`${slug} ${tier}: ${r.sourceMB} MB → ${r.MB} MB, ${r.triangles} tris, art ${r.art}px, data ${r.data}px (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}
const total = (tier) => +Object.entries(report).filter(([k]) => k.endsWith(tier)).reduce((a, [, v]) => a + v.MB, 0).toFixed(2);
report.totals = { desktopMB: total('/desktop'), mobileMB: total('/mobile') };
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log('totals', report.totals);
