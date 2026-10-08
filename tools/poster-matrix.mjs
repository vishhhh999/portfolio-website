/**
 * L6 (09B): every poster the site can show first, by shape, in one place (tools/make-posters.mjs
 * renders them, tools/check-poster.mjs compares them with the live booth, tools/poster-hash.mjs
 * gates the build on them).
 *
 * Home (the boot script picks one by <html data-shape> / data-columns):
 *   cabinet  wide and phone-landscape     poster-cabinet-{1200,2400}.webp, -1200.jpg   (+ -dark-)
 *   shelf4   square                       poster-shelf4-{1x,2x}.webp                   (+ -dark-)
 *   shelf2   tall, under 600px wide       poster-shelf2-{1x,2x}.webp: the whole shelf
 *   shelf3   tall, from 600px wide        poster-shelf3-{1x,2x}.webp: the whole shelf
 * Project headers (the tray shot; the header's proportions differ per shape):
 *   tray/<slug>.webp (wide) · -square · -phone (tall, 2 columns) · -tablet (tall, 3 columns)
 *
 * `render` is the viewport a poster is rendered at; `check` the viewports it is compared at.
 * The shelf's picture does not depend on the window's height (shots.ts shelfShot), so its posters are
 * rendered in a window tall enough to show the whole shelf: they cover it on every screen.
 */
export const HOME = [
  { name: 'cabinet', render: [1568, 980, 2, false], files: ['poster-cabinet-1200.webp', 'poster-cabinet-2400.webp', 'poster-cabinet-1200.jpg'], dark: ['poster-cabinet-dark-1200.webp', 'poster-cabinet-dark-2400.webp'], check: [[1568, 980, 1, false], [1376, 940, 1, false]] },
  { name: 'shelf4', render: [1180, 1000, 2, false], files: ['poster-shelf4-1x.webp', 'poster-shelf4-2x.webp'], dark: ['poster-shelf4-dark-1x.webp', 'poster-shelf4-dark-2x.webp'], check: [[1180, 1000, 1, false]] },
  { name: 'shelf2', render: [393, 1400, 2, true], files: ['poster-shelf2-1x.webp', 'poster-shelf2-2x.webp'], dark: ['poster-shelf2-dark-1x.webp', 'poster-shelf2-dark-2x.webp'], check: [[393, 659, 2, true], [390, 664, 2, true]] },
  { name: 'shelf3', render: [1032, 1700, 2, true], files: ['poster-shelf3-1x.webp', 'poster-shelf3-2x.webp'], dark: ['poster-shelf3-dark-1x.webp', 'poster-shelf3-dark-2x.webp'], check: [[1032, 1230, 1, true], [820, 1180, 1, true]] },
];
export const SLUGS = ['too-yumm', 'jsw-sports', 'mitooshi', 'sonde', 'house-of-hex', 'bengal-t20', 'sook', 'shunya', 'indo-thai'];
export const TRAY = [
  { suffix: '', render: [1568, 980, 1, false], quality: 80 },
  { suffix: '-square', render: [1180, 1000, 1, false], quality: 80 },
  { suffix: '-phone', render: [390, 844, 2, true], quality: 78 },
  { suffix: '-tablet', render: [1032, 1230, 1, true], quality: 80 },
];
export const POSTERS = [...HOME.flatMap((h) => [...h.files, ...h.dark]), ...SLUGS.flatMap((s) => TRAY.map((t) => `tray/${s}${t.suffix}.webp`))];
/** Elements over the booth that are not the booth (hidden for a capture). */
export const HIDE_HOME = '.booth-poster,.booth-cover,.masthead,.hero__copy,.panel-slot,.panel,.footer,.booth-focus,.specchip,.sampletags,.boothhint,.cursorlabel{visibility:hidden!important}';
export const HIDE_TRAY = '.booth-poster,.panel,.masthead,.specchip,.cursorlabel,.booth-stage::after{visibility:hidden!important}';
