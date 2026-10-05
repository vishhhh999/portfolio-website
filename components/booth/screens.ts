import { CanvasTexture, Color, SRGBColorSpace, type Material, type RectAreaLight, type Texture } from 'three';

/**
 * Device screens. Each screen shows its project's logo, centred on the brand's background colour
 * (public/brand/<slug>/logo.svg + bg.txt). Devices are always on: the lamp rig sets the emissive
 * level per lamp (bright and spilling onto the floor under SCREEN, a small glow under AFTER DARK,
 * plausible under the room lamps, where the glass on top reflects the booth). Each screen's spill
 * light takes the average colour of what it shows.
 *
 * If a project has no logo files, the screen falls back to the project's first still, cropped to
 * the screen's aspect. Never placeholder "UI".
 */

/** `light` is null on the mobile tier: one combined spill light in the lamp rig stands in for all screens. */
export type ScreenEntry = { material: Material & { emissiveIntensity?: number; userData: Record<string, unknown> }; light: RectAreaLight | null; colour: Color };
export const screens = new Set<ScreenEntry>();

const frameListeners = new Set<() => void>();
/** Notified when new screen content is ready to draw. */
export function onScreenFrame(cb: () => void) {
  frameListeners.add(cb);
  return () => void frameListeners.delete(cb);
}
const notify = () => frameListeners.forEach((cb) => cb());

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

async function brand(slug: string): Promise<{ logo: HTMLImageElement; bg: string } | null> {
  try {
    const res = await fetch(`/brand/${slug}/bg.txt`);
    if (!res.ok) return null;
    const bg = (await res.text()).trim();
    if (!/^#[0-9a-f]{6}$/i.test(bg)) return null;
    const logo = await loadImage(`/brand/${slug}/logo.svg`).catch(() => loadImage(`/brand/${slug}/logo.png`));
    return { logo, bg };
  } catch {
    return null;
  }
}

const cache = new Map<string, { texture: CanvasTexture; colour: Color }>();

/**
 * The screen image for a project at a screen aspect (w / h). Returns at once with a dark texture
 * and draws into it when the logo (or the fallback still) has loaded.
 */
export function screenTexture(slug: string, aspect: number, fallbackStill: string): { texture: Texture; colour: Color } {
  const key = `${slug}@${aspect.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const W = aspect >= 1 ? 1024 : Math.round(1024 * aspect);
  const H = Math.round(W / aspect);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#050506';
  g.fillRect(0, 0, W, H);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  // glTF UVs (the devices' screen meshes) have v = 0 at the top of the image
  texture.flipY = false;
  const colour = new Color(0.05, 0.05, 0.06);
  const entry = { texture, colour };
  cache.set(key, entry);

  void (async () => {
    const b = await brand(slug);
    if (b) {
      g.fillStyle = b.bg;
      g.fillRect(0, 0, W, H);
      // the logo fills 46% of the screen's short side, centred, at its own aspect
      const la = b.logo.naturalWidth / Math.max(1, b.logo.naturalHeight) || 1;
      const box = Math.min(W, H) * 0.46;
      const lw = la >= 1 ? Math.min(W * 0.62, box * la) : box * la;
      const lh = lw / la;
      g.drawImage(b.logo, (W - lw) / 2, (H - lh) / 2, lw, lh);
    } else {
      // no logo files: the first still, cropped to the screen (cover)
      const img = await loadImage(fallbackStill).catch(() => null);
      if (!img) return;
      const ia = img.naturalWidth / img.naturalHeight;
      const sw = ia > aspect ? img.naturalHeight * aspect : img.naturalWidth;
      const sh = ia > aspect ? img.naturalHeight : img.naturalWidth / aspect;
      g.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, W, H);
    }
    // the spill colour: the screen's average
    const s = document.createElement('canvas');
    s.width = s.height = 8;
    const sg = s.getContext('2d', { willReadFrequently: true })!;
    sg.drawImage(canvas, 0, 0, 8, 8);
    const px = sg.getImageData(0, 0, 8, 8).data;
    let r = 0, gg = 0, bl = 0;
    for (let i = 0; i < px.length; i += 4) {
      r += px[i];
      gg += px[i + 1];
      bl += px[i + 2];
    }
    colour.setRGB(r / 64 / 255, gg / 64 / 255, bl / 64 / 255, SRGBColorSpace);
    texture.needsUpdate = true;
    notify();
  })();
  return entry;
}
