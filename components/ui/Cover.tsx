/**
 * I (09): a project's cover (assets-src/covers, 1440x2000, 18:25), AVIF with a WebP fallback at 480,
 * 960 and 1440 wide (tools/cover-sizes.mjs). Used in the home Index preview and the case-study end cards.
 */
export const COVER_ASPECT = 1440 / 2000;
const set = (slug: string, ext: string) => [480, 960, 1440].map((w) => `/covers/${slug}-${w}.${ext} ${w}w`).join(', ');
export function Cover({ slug, sizes, alt = '', eager = false, className, on }: { slug: string; sizes: string; alt?: string; eager?: boolean; className?: string; on?: boolean }) {
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={set(slug, 'avif')} sizes={sizes} />
      <source type="image/webp" srcSet={set(slug, 'webp')} sizes={sizes} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/covers/${slug}-960.webp`} alt={alt} width={1440} height={2000} loading={eager ? 'eager' : 'lazy'} decoding="async" data-on={on} />
    </picture>
  );
}
