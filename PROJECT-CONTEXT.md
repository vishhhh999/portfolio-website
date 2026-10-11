# visheshmahendru.com: The Booth

Current as of batch 11 (11 Oct 2026, the quality reset). Read with `BRIEF.md` (the founding concept) and `AGENTS.md` (working rules). History of earlier batches: `docs/history/`.

## 1. What this is

The portfolio of Vishesh Mahendru (vishafterdark): brand, packaging, print, web, 3D. The site is a colour viewing booth rendered in WebGL; the work sits inside as physical objects and seven lamp switches relight it.

> "The one where you flip the lights and watch his work hold up under each one."

- Repo `github.com/vishhhh999/portfolio-website`. Vercel project `vishafterdark-projects/portfolio-website`; every branch gets a preview, `main` is production.
- Production URL until the cutover: https://portfolio-website-umber-psi-26.vercel.app/. The domain www.visheshmahendru.com still points at the old Framer site; the cutover is Vishesh's (`LAUNCH.md`).

### Lamps (keys 1 to 7; I is house lights, S is sound)

| Key | Lamp | Light in the booth |
| --- | --- | --- |
| 1 | D50 Daylight | Soft overhead diffuser, short soft shadows. The default. |
| 2 | TL84 Store | Tube bank straight overhead, green cast, flatter, flicker on strike. |
| 3 | A Home | One low tungsten lamp front right, long raking shadows, warm falloff. |
| 4 | UV Blacklight | Dark violet; white stock fluoresces, the proofer's notes glow on the object in focus. |
| 5 | Flood | One hard high spot, crisp shadows, dark edges, haze in the beam. |
| 6 | Screen | Lamps off; the device screens light the booth in their own colours. |
| 7 | After Dark | Black; a hand lamp follows the pointer (and lights the page images through a torch overlay). |

## 2. Locked rules

1. No distortion of images or type, anywhere.
2. Never invent facts. Copy, years, roles and clients come from `content/`; facts in `content/work/corrections.ts` are not edited.
3. No em dashes.
4. The lamp never switches by itself. Case-study images are never relit (After Dark's torch is a mask over the untouched file).
5. House lights is a mode of the current page, never a page (`<html data-house-lights>`, remembered only if the visitor chose it).
6. Content lives in the DOM; the canvas is `aria-hidden`. The objects are reachable as real links laid over the canvas.

## 3. Stack

Next.js 16 (App Router), React 19, three 0.186 with @react-three/fiber 9, Zustand, Lenis. Fonts: Instrument Serif (display), Geist (text), Geist Mono (data only), all self-hosted and subset. Bricolage Grotesque is kept only for the `?type=grotesk` preview. No postprocessing chain, no KTX2.

## 4. Pages

| Route | What |
| --- | --- |
| `/` | Editorial cover: the headline, the intro, the booth (two rows of objects in a light cabinet), the lamp bar docked under it, then the typographic project list (hover shows a cover). Tall screens get a portrait booth with three tiers. |
| `/work/[slug]` | Header: the whole booth, the project's object on the front tray under its own light, the other eight in place (at most 18% darker) and clickable. Tall screens: the tray close up and a strip of the other eight drawn live. Then title, lead, spec block, images (first full width, then pairs), single-column text, one previous/next module. |
| `/about` | The certificate of calibration. |
| `/archive` | Contact sheet with filters and a viewer. |
| `/house-lights` | Shareable link to the flat index. |
| `/projects/*` | 301 to `/work/*`. Never name a route segment `index`. |

Contact: every "Book a viewing" link uses `contactMailto()` in `lib/site.ts`.

## 5. How the booth works

- **One canvas** in `components/booth/Booth.tsx` (`BoothLayer`): an absolutely positioned layer at the top of the page, so it scrolls with the page and never redraws on scroll. It mounts after first paint and survives route changes.
- **Frames**: the page registers DOM boxes (`frames.ts`): the home frame, the project header view, the phone thumbnails. The canvas draws each with scissoring; `camera.ts` contain-fits the cabinet (or opening, or tray) into the box and shifts the lens to land on it exactly.
- **Rendering on demand** (`activity.ts`): anything that moves calls `kick(ms)`; nothing renders off screen or in a hidden tab. Resolution adapts both ways from measured frame time (`BoothCanvas.tsx`).
- **Lights** (`Rig.tsx`, presets in `lib/lampPresets.ts`): one shadow-casting spot (variance shadow map), a hemisphere fill, three screen spill spots, a tray spot, a per-lamp reflection environment (prefiltered once, cached). The light set never changes, so a lamp change never recompiles shaders.
- **Objects** (`Specimen.tsx`, layouts and display scales in `composition.ts`): one uniform display scale per object. Home loads the light (`.mobile.glb`) set; the object on the tray swaps to its detailed model. Hover lifts it with a soft rim; drag or arrow keys turn the tray object; the JSW book opens on the tray.
- **Links** (`ObjectLinks` in `Booth.tsx`): real `<a>` elements over each object's projected box. Hover or focus shows the spec chip; click is a client-side route change (the object slides to the tray, 720ms, `cubic-bezier(0.2, 0.7, 0.1, 1)`).
- **Posters**: `public/booth/poster-<home|slug>-<wide|tall>.webp`, the same camera rendered by `tools/make-posters.mjs`, crossfade to the live canvas.

## 6. Design system (`app/globals.css`)

- Type: six steps (`--t-display`, `--t-h1`, `--t-h2`, `--t-lead`, `--t-body` 16 to 18px, `--t-caption` 13px). Headlines in the display face, everything else in Geist; mono only for data.
- Space: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- Motion: moves 720ms on one curve, UI 150ms, reveals 300ms (text rises 10px, images only fade). Reduced motion turns it all off.

## 7. Assets

- Models: `assets-src/models/<slug>/` → `node tools/optimize-models.mjs` → `public/models/<slug>/` (WebP textures, meshopt).
- Case-study images: `public/work/<slug>/` with sized AVIF/WebP (`tools/proof-sizes.mjs`); covers in `public/covers/`.

## 8. Checks and numbers

- `npm run build`, `npm run verify` (types, routes, redirects, console, axe, screenshots). `node tools/weight.mjs` for bytes. `GL=gpu node tools/gpu-smoke.mjs` for real frame times (hardware only).
- Batch 11, software rendering: home first visit 2.74MB desktop (was 6.88MB), JS before the 3D 191KB gzipped. Frame times on a real GPU are still to be measured on Vishesh's PC.
