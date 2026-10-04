'use client';

import { useEffect, useRef, useState } from 'react';
import { useBooth } from '@/lib/store';
import { lampById } from '@/lib/lampPresets';
import { playEvent } from '@/lib/sound';
import { requestFrames } from '@/lib/clock';
import { loupeProbe } from '@/lib/loupe';

/** sRGB (0–255) → CIE L*a*b* (D50, Bradford-adapted from sRGB's D65), as a colorimeter reports it. */
function toLab(r: number, g: number, b: number) {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = lin(r), G = lin(g), B = lin(b);
  // sRGB → XYZ (D50), Bradford-adapted (the ICC / Lindbloom matrix)
  const X = 0.4360747 * R + 0.3850649 * G + 0.1430804 * B;
  const Y = 0.2225045 * R + 0.7168786 * G + 0.0606169 * B;
  const Z = 0.0139322 * R + 0.0971045 * G + 0.7141733 * B;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const fx = f(X / 0.96422), fy = f(Y / 1), fz = f(Z / 0.82521);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

const canvasCache = new WeakMap<HTMLImageElement, CanvasRenderingContext2D>();
/** The pixel of a DOM image under the pointer (D50 proofs are the plain image: what you see is the file). */
function imagePixel(img: HTMLImageElement, x: number, y: number) {
  let ctx = canvasCache.get(img);
  if (!ctx) {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    canvasCache.set(img, ctx);
  }
  const r = img.getBoundingClientRect();
  const px = Math.floor(((x - r.left) / r.width) * img.naturalWidth);
  const py = Math.floor(((y - r.top) / r.height) * img.naturalHeight);
  const d = ctx.getImageData(Math.max(0, Math.min(img.naturalWidth - 1, px)), Math.max(0, Math.min(img.naturalHeight - 1, py)), 1, 1).data;
  return [d[0], d[1], d[2], d[3]] as const;
}

type Reading = { hex: string; L: number; a: number; b: number; lamp: string; source: string } | null;

/**
 * The spectro loupe (I2): desktop, fine pointer only. Hold Alt, or press L, and the cursor becomes a
 * colorimeter reticle over proof images and the booth. It reads the pixel actually on screen under
 * it, at 15Hz: a D50 proof's own pixel (that DOM image is the file), or the WebGL output for the
 * booth and relit proofs (read right after the frame is drawn). It shows the hex, CIE L*a*b* (D50)
 * and the active lamp. Every value is measured; nothing is looked up.
 */
export function Loupe() {
  const [on, setOn] = useState(false);
  const [held, setHeld] = useState(false);
  const [reading, setReading] = useState<Reading>(null);
  const pos = useRef({ x: 0, y: 0 });
  const el = useRef<HTMLDivElement>(null);
  const active = on || held;
  // decided after mount (the server can't know the pointer): no hydration mismatch
  const [fine, setFine] = useState(false);
  useEffect(() => setFine(matchMedia('(pointer: fine)').matches), []);

  useEffect(() => {
    if (!fine) return;
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'Alt') setHeld(true);
      if ((e.key === 'l' || e.key === 'L') && !e.metaKey && !e.ctrlKey) {
        setOn((o) => !o);
        playEvent('loupe');
      }
      if (e.key === 'Escape') setOn(false);
    };
    const up = (e: KeyboardEvent) => e.key === 'Alt' && setHeld(false);
    const blur = () => setHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [fine]);

  useEffect(() => {
    if (!active) {
      setReading(null);
      document.documentElement.removeAttribute('data-loupe');
      return;
    }
    document.documentElement.setAttribute('data-loupe', '');
    let last = 0, restTimer = 0, lastHex = '';
    const move = (e: PointerEvent) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (el.current) el.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };
    const measure = async () => {
      const { x, y } = pos.current;
      const lamp = useBooth.getState().lamp;
      const target = document.elementFromPoint(x, y);
      let px: readonly number[] | null = null;
      let source = '';
      // a visible DOM proof image under the pointer (D50): its own pixel
      const img = target instanceof HTMLImageElement && target.closest('.proof__image, .archive__frame, .cert__portrait') && getComputedStyle(target).opacity !== '0' ? target : null;
      if (img && img.complete && img.naturalWidth) {
        try {
          px = imagePixel(img, x, y);
          source = 'proof';
        } catch {}
      }
      if (!px) {
        // otherwise the canvas: ask the booth to read its output under the pointer after the next frame
        const r = await loupeProbe(x, y, () => requestFrames(1));
        if (r && r[3] > 8) {
          px = r;
          source = 'booth';
        }
      }
      if (!px) {
        setReading(null);
        return;
      }
      const lab = toLab(px[0], px[1], px[2]);
      const h = hex(px[0], px[1], px[2]);
      setReading({ hex: h, ...lab, lamp: lampById(lamp).id === 'AFTERDARK' ? 'AFTER DARK' : lamp, source });
      // a tiny beep when a reading holds still (the pointer rests on one colour)
      if (h !== lastHex) {
        lastHex = h;
        window.clearTimeout(restTimer);
        restTimer = window.setTimeout(() => playEvent('beep', x), 450);
      }
    };
    let id = 0;
    const loop = (t: number) => {
      if (t - last > 1000 / 15) {
        last = t;
        void measure();
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    window.addEventListener('pointermove', move);
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(restTimer);
      window.removeEventListener('pointermove', move);
    };
  }, [active]);

  if (!fine) return null;
  return (
    <div ref={el} className="loupe" data-on={active} aria-hidden={!active} style={{ transform: `translate(${pos.current.x}px, ${pos.current.y}px)` }}>
      <span className="loupe__reticle" />
      {active && (
        <span className="loupe__readout mono" role="status">
          {reading ? (
            <>
              <span className="loupe__swatch" style={{ background: reading.hex }} />
              {reading.hex} · L {reading.L.toFixed(1)} a {reading.a.toFixed(1)} b {reading.b.toFixed(1)} · {reading.lamp}
            </>
          ) : (
            'Over a proof or the booth to measure'
          )}
        </span>
      )}
    </div>
  );
}
