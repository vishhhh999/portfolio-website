/**
 * C1 (09): the room lightmap for the web, from Vishesh's bake (assets-src/booth/lightmap.exr, half
 * float linear, and lightmap.png, its 16-bit linear twin; peak 0.925, so it fits a 0..1 range).
 *   desktop: public/booth/lightmap.ktx2   2048, UASTC, sRGB transfer (8-bit with the precision in the
 *            darks where the eye needs it; decoded to linear by the GPU, no shader decode), mipmaps, Zstandard
 *   phones:  public/booth/lightmap-phone.webp   1024, sRGB-encoded 8-bit WebP (no Basis transcoder on phones)
 * The 16-bit PNG and the EXR stay sources only: no device downloads them.
 *   node tools/encode-lightmap.mjs   (HDR=1 also tries UASTC HDR from the EXR, for the size comparison)
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync, statSync } from 'fs';
import { encodeToKTX2 } from 'ktx2-encoder';
const ROOT = new URL('../', import.meta.url).pathname;
const SRC = ROOT + 'assets-src/booth/lightmap.png';
const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
async function srgb8(size) {
  const { data, info } = await sharp(SRC).resize(size, size, { kernel: 'lanczos3' }).toColourspace('rgb16').raw({ depth: 'ushort' }).toBuffer({ resolveWithObject: true });
  const px = new Uint16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const ch = info.channels;
  const out = new Uint8Array(size * size * 4);
  for (let i = 0, j = 0; i < size * size; i++, j += ch) {
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(255 * enc(px[j + c] / 65535));
    out[i * 4 + 3] = 255;
  }
  return out;
}
const kb = (f) => Math.round(statSync(f).size / 1024);
// desktop: KTX2 UASTC (sRGB transfer), mipmapped
{
  const rgba = await srgb8(2048);
  const png = await sharp(Buffer.from(rgba), { raw: { width: 2048, height: 2048, channels: 4 } }).png().toBuffer();
  const ktx = await encodeToKTX2(new Uint8Array(png), { isUASTC: true, uastcLDRQualityLevel: 2, enableRDO: true, rdoQualityLevel: 2, needSupercompression: true, isSetKTX2SRGBTransferFunc: true, isPerceptual: true, generateMipmap: true, isKTX2File: true, imageDecoder: async () => ({ width: 2048, height: 2048, data: rgba }) });
  writeFileSync(ROOT + 'public/booth/lightmap.ktx2', ktx);
  console.log('lightmap.ktx2', kb(ROOT + 'public/booth/lightmap.ktx2'), 'KB');
}
// phones: 1024 WebP
{
  const rgba = await srgb8(1024);
  await sharp(Buffer.from(rgba), { raw: { width: 1024, height: 1024, channels: 4 } }).removeAlpha().webp({ quality: 90, smartSubsample: true, effort: 6 }).toFile(ROOT + 'public/booth/lightmap-phone.webp');
  console.log('lightmap-phone.webp', kb(ROOT + 'public/booth/lightmap-phone.webp'), 'KB');
}
if (process.env.HDR) {
  const exr = new Uint8Array(readFileSync(ROOT + 'assets-src/booth/lightmap.exr'));
  const ktx = await encodeToKTX2(exr, { isUASTC: true, isHDR: true, imageType: 'exr', hdrQualityLevel: 1, needSupercompression: true, generateMipmap: true, isKTX2File: true });
  writeFileSync('/tmp/lightmap-hdr.ktx2', ktx);
  console.log('UASTC HDR (comparison only)', kb('/tmp/lightmap-hdr.ktx2'), 'KB');
}
