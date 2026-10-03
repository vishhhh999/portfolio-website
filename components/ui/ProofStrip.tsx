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
 * layout (SEO, accessibility, fallback). On capable GPUs it registers as a
 * lit WebGL plane and is visually hidden once the plane has drawn, so the
 * active lamp relights the photograph itself.
 */
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
    void v.play().catch(() => {});
  }, [d]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !litPlanesEnabled()) return;
    return registerPlane({
      el,
      kind: d.type,
      src: d.src,
      fluorMask: d.fluorMask,
      uvInk: d.uvInk,
      onReady: () => setLit(true),
    });
  }, [d]);

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
              <video ref={ref} poster={d.poster} muted loop playsInline autoPlay preload="metadata" aria-label={d.alt} data-lit={lit}>
                {d.sources?.map((s) => <source key={s.src} src={s.src} type={s.type} />)}
                <source src={d.src} type="video/mp4" />
              </video>
              <button type="button" className="proof__play" onClick={() => onPlay(d)}>
                Play with sound
              </button>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img ref={ref} src={d.src} alt={d.alt} width={1600} height={1200} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" data-lit={lit} />
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

/** Exactly 6 deliverables as a proof strip; video frames open a player with sound. */
export function ProofStrip({ deliverables, serialBase }: { deliverables: Deliverable[]; serialBase: number }) {
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
      <ol className="proofstrip" aria-label="Deliverables">
        {deliverables.slice(0, 6).map((d, i) => (
          <li key={d.src}>
            <ProofFrame d={d} index={i} serial={serialBase + i} onPlay={setPlaying} />
          </li>
        ))}
      </ol>
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
