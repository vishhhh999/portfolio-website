'use client';

import { useEffect, useRef, useState } from 'react';
import { litPlanesEnabled } from '@/lib/gpuTier';
import { useBooth } from '@/lib/store';
import type { Deliverable } from '@/lib/types';
import { registerPlane } from '@/lib/views';

const BAR = ['#009ee0', '#e2007a', '#ffed00', '#1e1e1e', '#e2231a', '#009640', '#2d2e83', '#f3f3f2', '#a0a0a0', '#555555'];

function RegTarget({ className }: { className: string }) {
  return (
    <svg className={`proof__reg ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M0 12h24M12 0v24" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/**
 * One frame of the proof strip. The DOM <img>/<video> always stays in the
 * layout (SEO, accessibility, fallback) and is what shows under D50. On
 * capable GPUs, under any other lamp, it registers as a lit WebGL plane and
 * fades out once the plane has drawn, so the lamp relights the photograph.
 */
const aspectOf = (d: Deliverable) => (d.width && d.height ? d.width / d.height : 4 / 3);

/**
 * Contact-sheet rhythm: a hero frame, then a 2-up and a 3-up row. A portrait
 * opener starts with a 2-up instead. Each frame's width is proportional to its
 * image's real aspect ratio, so every row shares one height and nothing is cropped.
 */
function rows(list: Deliverable[], part: StripPart): number[][] {
  const idx = list.map((_, i) => i);
  const heroCount = aspectOf(list[0]) >= 1.2 ? 1 : Math.min(2, list.length);
  if (part === 'hero') return [idx.slice(0, heroCount)];
  const rest = part === 'rest' ? idx.slice(heroCount) : idx;
  const pattern = part === 'rest' ? [2, 3] : heroCount === 1 ? [1, 2, 3] : [2, 2, 2];
  const out: number[][] = [];
  let p = 0;
  while (rest.length) out.push(rest.splice(0, pattern[p++ % pattern.length]));
  return out;
}

/** 'hero' = the opening frame (work first, straight under the title); 'rest' = everything after it. */
type StripPart = 'all' | 'hero' | 'rest';

function ProofFrame({ d, index, serial, onPlay }: { d: Deliverable; index: number; serial: number; onPlay: (d: Deliverable) => void }) {
  const ref = useRef<HTMLImageElement & HTMLVideoElement>(null);
  const [lit, setLit] = useState(false);
  const lamp = useBooth((s) => s.lamp);

  // React sets `muted` as a property after mount, which can block autoplay: set it and start playback explicitly.
  useEffect(() => {
    const el = ref.current;
    if (d.type !== 'video' || !el) return;
    const v = el as HTMLVideoElement;
    v.muted = true;
    v.defaultMuted = true;
    // decode only near the screen: play within one viewport, pause beyond it (battery, GPU upload)
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [d]);

  // D50 is pixel-exact: the plain <img>/<video>, no WebGL plane, no grain, matrix or bloom.
  // A relit plane only exists while the visitor has another lamp on; the DOM frame crossfades
  // out over it (300ms) once it has drawn, and back in before the plane goes on returning to D50.
  const relit = lamp !== 'D50';
  useEffect(() => {
    const el = ref.current;
    if (!el || !relit || !litPlanesEnabled()) return;
    const off = registerPlane({
      el,
      kind: d.type,
      src: d.src,
      fluorMask: d.fluorMask,
      uvInk: d.uvInk,
      onReady: () => setLit(true),
    });
    return () => {
      setLit(false);
      window.setTimeout(off, 320); // keep the plane under the fading-in DOM frame
    };
  }, [d, relit]);

  const slug = `VM_PROOF_${String(serial).padStart(4, '0')} · ${lamp === 'AFTERDARK' ? 'AFTER DARK' : lamp} · 2026-10`;

  return (
    <figure className="proof">
      <div className="proof__sheet">
        <span className="proof__crop proof__crop--tl" aria-hidden="true" />
        <span className="proof__crop proof__crop--tr" aria-hidden="true" />
        <span className="proof__crop proof__crop--bl" aria-hidden="true" />
        <span className="proof__crop proof__crop--br" aria-hidden="true" />
        <RegTarget className="proof__reg--top" />
        <RegTarget className="proof__reg--bottom" />
        <span className="proof__bar" aria-hidden="true">
          {BAR.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </span>
        <div className="proof__image">
          {d.type === 'video' ? (
            <>
              <video ref={ref} poster={d.poster} muted loop playsInline autoPlay preload="metadata" aria-label={d.alt} data-lit={lit} style={{ aspectRatio: `${aspectOf(d)}` }}>
                {d.sources?.map((s) => <source key={s.src} src={s.src} type={s.type} />)}
                <source src={d.src} type="video/mp4" />
              </video>
              <button type="button" className="proof__play" onClick={() => onPlay(d)}>
                Play with sound
              </button>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={ref} src={d.src} alt={d.alt} width={d.width ?? 1600} height={d.height ?? 1200} loading={index < 3 ? 'eager' : 'lazy'} decoding="async" data-lit={lit} style={{ aspectRatio: `${aspectOf(d)}` }} />
          )}
        </div>
      </div>
      <figcaption className="proof__caption">
        <span className="proof__num">{String(index + 1).padStart(2, '0')}</span>
        <span className="slug">{slug}</span>
      </figcaption>
    </figure>
  );
}

/** Up to 6 deliverables as a proof strip; video frames open a player with sound. */
export function ProofStrip({ deliverables, serialBase, part = 'all' }: { deliverables: Deliverable[]; serialBase: number; part?: StripPart }) {
  const [playing, setPlaying] = useState<Deliverable | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = dialog.current;
    if (!dlg) return;
    if (playing && !dlg.open) dlg.showModal();
    if (!playing && dlg.open) dlg.close();
  }, [playing]);

  return (
    <>
      <div className="proofstrip" data-part={part} role="list" aria-label={part === 'rest' ? 'More deliverables' : 'Deliverables'}>
        {rows(deliverables.slice(0, 6), part).map((row) => (
          <div key={row.join('-')} className="proofrow" data-count={row.length}>
            {row.map((i) => {
              const d = deliverables[i];
              const a = aspectOf(d);
              return (
                <div key={d.src} role="listitem" className="proofrow__item" style={{ flexGrow: a, flexBasis: 0, ['--aspect' as string]: a }}>
                  <ProofFrame d={d} index={i} serial={serialBase + i} onPlay={setPlaying} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <dialog ref={dialog} className="player" onClose={() => setPlaying(null)} aria-label={playing?.alt ?? 'Video'}>
        {playing && (
          <video controls autoPlay playsInline>
            {playing.sources?.map((s) => <source key={s.src} src={s.src} type={s.type} />)}
            <source src={playing.src} type="video/mp4" />
          </video>
        )}
        <form method="dialog">
          <button className="player__close" type="submit">Close</button>
        </form>
      </dialog>
    </>
  );
}
