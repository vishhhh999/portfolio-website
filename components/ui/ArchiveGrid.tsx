'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import type { ArchivePiece, ArchiveSeries } from '@/content/archive';

const yearKey = (s: ArchiveSeries) => (s.year ? String(s.year) : 'tbc');

/**
 * The archive contact sheet: every piece, lazy-loaded, at its real aspect ratio.
 * Filters (project, year) live in the URL, so a filtered view can be linked.
 */
export function ArchiveGrid({ pieces, series }: { pieces: ArchivePiece[]; series: ArchiveSeries[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === 'all') next.delete(key);
    else next.set(key, value);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  return <ArchiveView pieces={pieces} series={series} project={params.get('project') ?? 'all'} year={params.get('year') ?? 'all'} onSet={set} />;
}

/** The grid itself; also the server-rendered, unfiltered fallback (no onSet: filters inert until hydrated). */
export function ArchiveView({
  pieces,
  series,
  project = 'all',
  year = 'all',
  onSet,
}: {
  pieces: ArchivePiece[];
  series: ArchiveSeries[];
  project?: string;
  year?: string;
  onSet?: (key: string, value: string) => void;
}) {
  const years = useMemo(() => [...new Set(series.map(yearKey))].sort(), [series]);
  const shown = pieces.filter((p) => (project === 'all' || p.series.id === project) && (year === 'all' || yearKey(p.series) === year));

  const set = onSet ?? (() => {});

  return (
    <>
      <div className="archive__filters" role="group" aria-label="Filter the archive">
        <label>
          <span className="mono">Project</span>
          <select value={project} onChange={(e) => set('project', e.target.value)}>
            <option value="all">All projects ({pieces.length})</option>
            {series.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({s.items.length})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mono">Year</span>
          <select value={year} onChange={(e) => set('year', e.target.value)}>
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y === 'tbc' ? 'Year TBC' : y}
              </option>
            ))}
          </select>
        </label>
        <p className="mono archive__count" aria-live="polite">
          {shown.length} of {pieces.length}
        </p>
      </div>

      <ol className="archive">
        {shown.map((p) => {
          const href = p.series.work ? `/work/${p.series.work}` : `/archive?project=${p.series.id}`;
          return (
            <li key={p.n} id={`a${String(p.n).padStart(2, '0')}`} className="archive__item">
              <Link href={href} scroll={false} className="archive__link">
                <span className="archive__frame" style={{ aspectRatio: `${p.width ?? 1} / ${p.height ?? 1}` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={p.alt} width={p.width} height={p.height} loading="lazy" decoding="async" />
                </span>
                <span className="archive__caption mono">
                  A{String(p.n).padStart(2, '0')} · {p.series.label} · {p.series.year ?? 'Year TBC'}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
