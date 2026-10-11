'use client';

import { useEffect, useRef, useState } from 'react';
import { useBooth } from '@/lib/store';
import type { Deliverable } from '@/lib/types';
import { avifFor } from '@/content/masters';
import { sizedFile, srcSetFor } from '@/lib/responsive';
import AUDIO from '@/content/audio.json';

const hasSound = (d: { src: string; sources?: { src: string }[] }) => [d.src, ...(d.sources ?? []).map((x) => x.src)].some((src) => (AUDIO as Record<string, boolean>)[src]);
const aspectOf = (d: Deliverable) => (d.width && d.height ? d.width / d.height : 4 / 3);

/**
 * The case-study images. Always the plain files under every lamp (never relit). Each frame carries
 * one quiet print mark: its frame number and the slug line naming the lamp you are looking under.
 * The first frame spans the column; the rest pair up, each row sharing one height so nothing is cropped.
 */
function Frame({ d, index, serial, onPlay, sizes, eager }: { d: Deliverable; index: number; serial: number; onPlay: (d: Deliverable) => void; sizes: string; eager: boolean }) {
  const ref = useRef<HTMLImageElement & HTMLVideoElement>(null);
  const lamp = useBooth((s) => s.lamp);
  useEffect(() => {
    const el = ref.current;
    if (d.type !== 'video' || !el) return;
    const v = el as HTMLVideoElement;
    v.muted = true;
    v.defaultMuted = true;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? void v.play().catch(() => {}) : v.pause()), { rootMargin: '25% 0px' });
    io.observe(v);
    return () => io.disconnect();
  }, [d]);
  const slug = `VM_PROOF_${String(serial).padStart(4, '0')} · ${lamp === 'AFTERDARK' ? 'AFTER DARK' : lamp}`;
  return (
    <figure className="proof">
      <div className="proof__image" style={{ aspectRatio: `${aspectOf(d)}` }}>
        {d.type === 'video' ? (
          <>
            <video ref={ref} poster={d.poster ? sizedFile(d.poster, 1200) : undefined} muted loop playsInline preload="none" aria-label={d.alt}>
              {d.sources?.map((s) => <source key={s.src} src={s.src} type={s.type} />)}
              <source src={d.src} type="video/mp4" />
            </video>
            {hasSound(d) && (
              <button type="button" className="proof__play" onClick={() => onPlay(d)}>
                Play with sound
              </button>
            )}
          </>
        ) : (
          <picture>
            {srcSetFor(d.src, 'avif') ? (
              <>
                <source srcSet={srcSetFor(d.src, 'avif')!} sizes={sizes} type="image/avif" />
                <source srcSet={srcSetFor(d.src, 'webp')!} sizes={sizes} type="image/webp" />
              </>
            ) : (
              avifFor(d.src) && <source srcSet={avifFor(d.src)!} type="image/avif" />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={ref} src={d.src} alt={d.alt} width={d.width ?? 1600} height={d.height ?? 1200} loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'} decoding="async" />
          </picture>
        )}
      </div>
      <figcaption className="proof__caption">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <span>{slug}</span>
      </figcaption>
    </figure>
  );
}

export function Proofs({ deliverables, serialBase, items, label }: { deliverables: Deliverable[]; serialBase: number; items: number[]; label: string }) {
  const [playing, setPlaying] = useState<Deliverable | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dlg = dialog.current;
    if (!dlg) return;
    if (playing && !dlg.open) dlg.showModal();
    if (!playing && dlg.open) dlg.close();
  }, [playing]);
  const list = items.filter((i) => deliverables[i]);
  const rows: number[][] = [];
  for (let i = 0; i < list.length; ) {
    const take = i === 0 && list[0] === 0 ? 1 : 2;
    rows.push(list.slice(i, i + take));
    i += take;
  }
  return (
    <>
      <div className="proofs" role="list" aria-label={label}>
        {rows.map((row) => (
          <div key={row.join('-')} className="proofs__row" data-count={row.length} data-reveal="">
            {row.map((i) => {
              const d = deliverables[i];
              return (
                <div key={d.src} role="listitem" className="proofs__item" style={{ flexGrow: aspectOf(d), flexBasis: 0 }}>
                  <Frame d={d} index={i} serial={serialBase + i} onPlay={setPlaying} sizes={row.length === 1 ? '(max-width: 760px) 100vw, min(92vw, 1600px)' : '(max-width: 760px) 100vw, 46vw'} eager={i === 0} />
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
