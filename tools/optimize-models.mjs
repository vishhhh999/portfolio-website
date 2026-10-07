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
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { ktx2 } from 'ktx2-encoder/gltf-transform';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
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
/**
 * B1 (09): parts that sit within 0.5mm of another part, facing the same way, where both can be seen
 * (tools/check-coplanar.mjs), are moved apart here by a fraction of a millimetre: a decal off its lid,
 * a garment off the flag under it. `dir` is a model-space direction, or 'screen' for the facing of
 * the device's display (its average normal). Positions only; nothing else in the file changes.
 */
const NUDGE = {
  // the device's front is +Z: 'screen' is the display's facing (toward the viewer), 'back' its opposite
  mitooshi: { logo: { mm: 0.4, dir: 'back' }, bezel: { mm: 0.49, dir: 'screen' } },
  'bengal-t20': { jersey: { mm: 0.3, dir: [0, 1, 0] }, ticket: { mm: 0.3, dir: [0, 1, 0] } },
  sonde: { easel: { mm: 0.4, dir: [0, -0.966, 0.259] } },
  'house-of-hex': { phone: { mm: 0.5, dir: 'screen' }, screen: { mm: 0.5, dir: 'screen' } },
};

/** A node's average face normal in model space (a flat part: its facing). */
function facing(node) {
  const m = node.getWorldMatrix();
  const sum = [0, 0, 0];
  for (const p of node.getMesh()?.listPrimitives() ?? []) {
    const pos = p.getAttribute('POSITION'), idx = p.getIndices();
    const n = idx ? idx.getCount() : pos.getCount();
    const P = (i) => {
      const v = pos.getElement(idx ? idx.getScalar(i) : i, []);
      return [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r]);
    };
    for (let i = 0; i + 2 < n; i += 3) {
      const a = P(i), b = P(i + 1), c = P(i + 2);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      sum[0] += u[1] * w[2] - u[2] * w[1];
      sum[1] += u[2] * w[0] - u[0] * w[2];
      sum[2] += u[0] * w[1] - u[1] * w[0];
    }
  }
  const l = Math.hypot(...sum) || 1;
  return sum.map((v) => v / l);
}

function nudge(doc, slug) {
  const table = NUDGE[slug];
  if (!table) return;
  const nodes = doc.getRoot().listNodes();
  const byName = (n) => nodes.find((x) => x.getName() === n);
  for (const [name, { mm, dir, sign = 1 }] of Object.entries(table)) {
    const node = byName(name);
    if (!node) throw new Error(`nudge: ${slug} has no node ${name}`);
    // a display plane's winding can face either way: orient it to the device's front (+Z)
    const f = dir === 'screen' || dir === 'back' ? facing(byName('screen')) : null;
    if (f && f[2] < 0) f.forEach((v, i) => (f[i] = -v));
    const d = dir === 'screen' ? f : dir === 'back' ? f.map((v) => -v) : dir;
    const t = node.getTranslation();
    node.setTranslation(t.map((v, i) => v + (d[i] * sign * mm) / 1000));
  }
}

const SIZES = {
  // A (09): desktop artwork is WebP (EXT_texture_webp) wherever it beats UASTC: at these sizes WebP is
  // 3 to 5 times smaller for the same visible quality (08 proved it on the JSW book), which is what
  // brings the desktop set under 7MB. Normal and ORM maps stay KTX2 (ETC1S, small and GPU-compressed).
  // Lossless PNG art in textures/ is preferred over the copy embedded in the GLB.
  'too-yumm': { desktop: { art: 1024, data: 512, webp: 90 }, mobile: { art: 512, data: 512 } },
  sook: { desktop: { art: 1024, data: 512, webp: 90 }, mobile: { art: 512, data: 256 } },
  // F3 (08): the tray hero, WebP at the full 2048 from the lossless PNG art (UASTC showed a block grid)
  'jsw-sports': { desktop: { art: 2048, data: 1024, webp: 92, dataWebp: true }, mobile: { art: 768, data: 256 } },
  // A2 (09): artwork capped at 1536 and ORM / normal at 1024 on desktop, 768 / 512 on phones; the phone
  // mesh is decimated (the source LOD1 still carries the jar's 120 crystals and the tin's beads); the
  // unused UV0 set is dropped (every SHUNYA material reads the UV1 atlas)
  shunya: { desktop: { art: 1536, normal: 1024, data: 512, webp: 80, simplify: 0.4, pruneAttributes: true }, mobile: { art: 768, normal: 256, data: 256, simplify: 0.3, pruneAttributes: true } },
  // batch 07 (A1): the devices, the tug and the Bengal set
  mitooshi: { desktop: { art: 1024, data: 1024, webp: 90 }, mobile: { art: 512, data: 512 } },
  'house-of-hex': { desktop: { art: 1024, data: 512, webp: 90 }, mobile: { art: 512, data: 256 } },
  sonde: { desktop: { art: 1024, data: 512, webp: 90 }, mobile: { art: 512, data: 256 } },
  'indo-thai': { desktop: { art: 1024, data: 512, webp: 90 }, mobile: { art: 512, data: 256 } },
  'bengal-t20': { desktop: { art: 1024, data: 512, webp: 90 }, mobile: { art: 512, data: 256 } },
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
await MeshoptSimplifier.ready;
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
  // A (09): Blender exports can carry extra empty scenes (a reference-image scene, a diagnostics one);
  // only the default scene is ever shown, so the others go
  const keep = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  for (const sc of doc.getRoot().listScenes()) if (sc !== keep) sc.dispose();
  nudge(doc, slug);
  // lossless PNG art beside the GLB (textures/<texture name>.png) replaces the embedded copy
  for (const t of doc.getRoot().listTextures()) {
    const png = join(ROOT, 'assets-src/models', slug, 'textures', `${t.getName()}.png`);
    if (size.webp && tier === 'desktop' && existsSync(png)) t.setImage(new Uint8Array(readFileSync(png))).setMimeType('image/png');
  }
  const pruneOpts = { keepAttributes: !size.pruneAttributes }; // A3 (07): device screens keep UV0 (it maps the logo)
  const simplifyStep = size.simplify ? [weld(), simplify({ simplifier: MeshoptSimplifier, ratio: size.simplify, error: tier === 'mobile' ? 0.02 : 0.004, lockBorder: false })] : [];
  if (tier === 'mobile') {
    // H3 (07): phones get WebP textures (EXT_texture_webp), not KTX2, so a phone never downloads the
    // 0.25MB Basis transcoder. Normal and data maps at higher quality (they are not colour).
    await doc.transform(
      dedup(),
      prune(pruneOpts),
      weld(),
      ...simplifyStep,
      textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 82, resize: [size.art, size.art], slots: ART }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 92, resize: [size.normal ?? size.data, size.normal ?? size.data], slots: NORMAL }),
      textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 92, resize: [size.data, size.data], slots: DATA }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
  } else {
    await doc.transform(
      dedup(),
      prune(pruneOpts),
      weld(),
      ...simplifyStep,
      // artwork: WebP where set (A 09), else UASTC, sRGB, RDO for size, Zstandard
      ...(size.webp
        ? [textureCompress({ encoder: sharp, targetFormat: 'webp', quality: size.webp, resize: [size.art, size.art], slots: ART })]
        : [
            textureCompress({ encoder: sharp, targetFormat: 'png', resize: [size.art, size.art], slots: ART }),
            ktx2({ slots: ART, isUASTC: true, uastcLDRQualityLevel: 2, enableRDO: true, rdoQualityLevel: 1.5, needSupercompression: true, isSetKTX2SRGBTransferFunc: true, generateMipmap: true, isKTX2File: true, imageDecoder }),
          ]),
      ...(size.dataWebp
        ? [textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 92, resize: [size.data, size.data], slots: new RegExp(`${NORMAL.source}|${DATA.source}`, 'i') })]
        : [
            textureCompress({ encoder: sharp, targetFormat: 'png', resize: [size.normal ?? size.data, size.normal ?? size.data], slots: NORMAL }),
            textureCompress({ encoder: sharp, targetFormat: 'png', resize: [size.data, size.data], slots: DATA }),
            // normal maps: ETC1S tuned for normals, linear
            ktx2({ slots: NORMAL, isUASTC: false, isNormalMap: true, qualityLevel: 230, compressionLevel: 2, isSetKTX2SRGBTransferFunc: false, isPerceptual: false, generateMipmap: true, isKTX2File: true, imageDecoder }),
            // ORM and other data maps: ETC1S, linear
            ktx2({ slots: DATA, isUASTC: false, qualityLevel: 200, compressionLevel: 2, isSetKTX2SRGBTransferFunc: false, isPerceptual: false, generateMipmap: true, isKTX2File: true, imageDecoder }),
          ]),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
  }
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
  for (const tier of (process.env.TIERS || 'desktop,mobile').split(',')) {
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
