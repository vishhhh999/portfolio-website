import { Color, SRGBColorSpace, VideoTexture, type MeshBasicMaterial, type RectAreaLight } from 'three';

/**
 * SCREEN placeholders: one shared looping test video, each device shows its own
 * horizontal region of it. Every ~10 frames the video is drawn into a tiny canvas
 * and averaged per region; that colour drives the RectAreaLight on each screen,
 * so the spill on the floor follows what's on the screen.
 */
export type ScreenRegion = [u0: number, u1: number];
export const REGIONS = {
  laptop: [0, 0.5] as ScreenRegion,
  tablet: [0.5, 0.75] as ScreenRegion,
  phone: [0.75, 1] as ScreenRegion,
};

type ScreenEntry = { material: MeshBasicMaterial; light: RectAreaLight; region: ScreenRegion; colour: Color };
export const screens = new Set<ScreenEntry>();

let video: HTMLVideoElement | null = null;
let texture: VideoTexture | null = null;
const readyListeners = new Set<() => void>();

/** Called when a new poster frame is available while paused (VideoTexture only auto-updates while playing). */
export function onScreenFrame(cb: () => void) {
  readyListeners.add(cb);
  return () => void readyListeners.delete(cb);
}

export function getScreenTexture(): VideoTexture {
  if (texture) return texture;
  video = document.createElement('video');
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  for (const [src, type] of [['/media/screen-test.webm', 'video/webm'], ['/media/screen-test.mp4', 'video/mp4']]) {
    const s = document.createElement('source');
    s.src = src;
    s.type = type;
    video.appendChild(s);
  }
  const poster = () => {
    if (!texture) return;
    texture.needsUpdate = true;
    sampleScreens(true);
    readyListeners.forEach((cb) => cb());
  };
  video.addEventListener('loadeddata', () => {
    if (video && video.paused) video.currentTime = 1.2; // a frame with content on every region
  }, { once: true });
  video.addEventListener('seeked', poster);
  video.load();
  texture = new VideoTexture(video);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function setScreensPlaying(playing: boolean) {
  if (!video) return;
  if (playing && video.paused) void video.play().catch(() => {});
  if (!playing && !video.paused) video.pause();
}

const SW = 32;
const SH = 9;
let sampler: CanvasRenderingContext2D | null = null;
let frame = 0;

/** Updates each screen's spill colour from the video. Cheap: 32×9 readback every 10 frames. */
export function sampleScreens(force = false) {
  if (!video || video.readyState < 2) return;
  if (!force && frame++ % 10 !== 0) return;
  if (!sampler) {
    const c = document.createElement('canvas');
    c.width = SW;
    c.height = SH;
    sampler = c.getContext('2d', { willReadFrequently: true });
  }
  if (!sampler) return;
  sampler.drawImage(video, 0, 0, SW, SH);
  const px = sampler.getImageData(0, 0, SW, SH).data;
  for (const s of screens) {
    const x0 = Math.floor(s.region[0] * SW);
    const x1 = Math.max(x0 + 1, Math.floor(s.region[1] * SW));
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = 0; y < SH; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * SW + x) * 4;
        r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      }
    s.colour.setRGB(r / n / 255, g / n / 255, b / n / 255, SRGBColorSpace);
  }
}
