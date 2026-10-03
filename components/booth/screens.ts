import { Color, SRGBColorSpace, TextureLoader, VideoTexture, type MeshBasicMaterial, type RectAreaLight, type Texture } from 'three';

/**
 * Device screens. Devices are always on: under every lamp each screen shows a
 * still frame at a plausible emissive level. In SCREEN mode the still swaps to
 * the live looping video (same sampler, no shader recompile) and the screens
 * become the only light: each screen's RectAreaLight takes the average colour
 * of its region of the video, sampled from a tiny canvas every ~10 frames, so
 * the spill on the floor follows what is on screen.
 *
 * Placeholder media: one shared test video + still; each device shows its own
 * horizontal region. Real captures (Phase 4) replace both files.
 */
export type ScreenRegion = [u0: number, u1: number];
export const REGIONS = {
  laptop: [0, 0.5] as ScreenRegion,
  tablet: [0.5, 0.75] as ScreenRegion,
  phone: [0.75, 1] as ScreenRegion,
};

type ScreenEntry = { material: MeshBasicMaterial; light: RectAreaLight; region: ScreenRegion; colour: Color };
export const screens = new Set<ScreenEntry>();

let poster: Texture | null = null;
let video: HTMLVideoElement | null = null;
let videoTex: VideoTexture | null = null;
const frameListeners = new Set<() => void>();

/** Notified when new screen content is ready to draw (poster loaded, or video ready). */
export function onScreenFrame(cb: () => void) {
  frameListeners.add(cb);
  return () => void frameListeners.delete(cb);
}
const notify = () => frameListeners.forEach((cb) => cb());

/** The still frame: a plain image texture, so it uploads reliably on every GPU. */
export function getPosterTexture(): Texture {
  if (poster) return poster;
  poster = new TextureLoader().load('/media/screen-test-poster.webp', () => {
    samplePoster();
    notify();
  });
  poster.colorSpace = SRGBColorSpace;
  return poster;
}

/** The live video, created on first use (SCREEN mode) or idle preload. */
export function getVideoTexture(): VideoTexture {
  if (videoTex) return videoTex;
  video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  for (const [src, type] of [
    ['/media/screen-test.webm', 'video/webm'],
    ['/media/screen-test.mp4', 'video/mp4'],
  ]) {
    const s = document.createElement('source');
    s.src = src;
    s.type = type;
    video.appendChild(s);
  }
  video.addEventListener('loadeddata', notify, { once: true });
  video.load();
  videoTex = new VideoTexture(video);
  videoTex.colorSpace = SRGBColorSpace;
  return videoTex;
}

/** Live video in SCREEN mode, still frame otherwise. Returns the texture screens should show. */
export function screenSource(live: boolean): Texture {
  if (!live) {
    if (video && !video.paused) video.pause();
    return getPosterTexture();
  }
  const tex = getVideoTexture();
  if (video!.paused) void video!.play().catch(() => {});
  return video!.readyState >= 2 ? tex : getPosterTexture();
}

const SW = 32;
const SH = 9;
let sampler: CanvasRenderingContext2D | null = null;
let frame = 0;

function ctx() {
  if (!sampler) {
    const c = document.createElement('canvas');
    c.width = SW;
    c.height = SH;
    sampler = c.getContext('2d', { willReadFrequently: true });
  }
  return sampler;
}

function averageRegions(source: CanvasImageSource) {
  const g = ctx();
  if (!g) return;
  g.drawImage(source, 0, 0, SW, SH);
  const px = g.getImageData(0, 0, SW, SH).data;
  for (const s of screens) {
    const x0 = Math.floor(s.region[0] * SW);
    const x1 = Math.max(x0 + 1, Math.floor(s.region[1] * SW));
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = 0; y < SH; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * SW + x) * 4;
        r += px[i]; gg += px[i + 1]; b += px[i + 2]; n++;
      }
    s.colour.setRGB(r / n / 255, gg / n / 255, b / n / 255, SRGBColorSpace);
  }
}

function samplePoster() {
  const img = poster?.image as HTMLImageElement | undefined;
  if (img && img.complete) averageRegions(img);
}

/** Spill colours from the live video. Cheap: 32×9 readback every 10 frames. */
export function sampleScreens() {
  if (!video || video.readyState < 2) return;
  if (frame++ % 10 !== 0) return;
  averageRegions(video);
}
