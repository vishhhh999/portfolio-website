import { SIZES } from '@/content/sizes';

/**
 * H3: srcset for a case-study image from its generated sizes (tools/proof-sizes.mjs):
 * /work/sook/01.webp → "/work/sook/sized/01-640.avif 640w, …". Null when no sizes exist.
 */
export function srcSetFor(src: string, fmt: 'avif' | 'webp'): string | null {
  const widths = SIZES[src];
  if (!widths?.length) return null;
  const base = src.replace(/\/([^/]+)\.webp$/, '/sized/$1');
  return widths.map((w) => `${base}-${w}.${fmt} ${w}w`).join(', ');
}

/** A single sized file (e.g. a video poster): the smallest generated width ≥ `want`. */
export function sizedFile(src: string, want: number, fmt: 'avif' | 'webp' = 'webp'): string {
  const widths = SIZES[src];
  if (!widths?.length) return src;
  const w = widths.find((x) => x >= want) ?? widths[widths.length - 1];
  return src.replace(/\/([^/]+)\.webp$/, `/sized/$1-${w}.${fmt}`);
}
