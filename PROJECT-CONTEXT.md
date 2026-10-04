# visheshmahendru.com: The Booth. Full project context

This document holds everything needed to pick the project up cold, by you or by a new Claude session. It is current as of 4 Oct 2026, after batch 06 (glitches, layout, proofs untouched, house lights as a mode, About, composition, SCREEN).

Paste it (or point to it) at the start of any new session, together with `BRIEF.md` from the repo.

---

## 1. What this is

The portfolio site of Vishesh Mahendru: brand, packaging, print, web, 3D. Handle: vishafterdark.

- **Repo:** `github.com/vishhhh999/portfolio-website`
- **Hosting:** Vercel, project `vishafterdark-projects/portfolio-website`. Every branch gets a preview URL, and `main` deploys to production.
- **Domain:** www.visheshmahendru.com. The site was previously on Framer. That Framer site was the source for all imported copy and images.

**The concept, in one sentence: "The one where you flip the lights and watch his work hold up under each one."**

The whole site is a colour viewing booth: the grey box print and packaging people use to check colour under standard lamps. It is rendered in real-time WebGL. The work sits inside as physical objects, and the navigation is a panel of lamp switches. Each switch physically relights every object in the booth. The case-study images on the project pages keep their own colour under every lamp (see §2).

The full original concept, phases and locked rules are in `BRIEF.md` in the repo. That file is the founding document; read it first.

### The seven lamps

| Key | Lamp | Basis | Native to |
|---|---|---|---|
| 1 | D50 · Daylight | 5000K print proofing, the "truth" state | JSW Sports |
| 2 | TL84 · Store | Retail fluorescent | Too Yumm, SOOK |
| 3 | A · Home | 2856K tungsten | SHUNYA |
| 4 | UV · Blacklight | UV-A; paper fluoresces and hidden "invisible ink" design notes appear | All |
| 5 | FLOOD | Stadium flood, hard light from above, haze cone | Bengal T20 League |
| 6 | SCREEN | All lamps off; only the device screens light the booth | Mitooshi, House of Hex, Indo Thai, Sonde |
| 7 | AFTER DARK | Total black; the cursor becomes a hand lamp | All |

- **I:** House lights. A mode of the current page, never a page: the booth goes and the page shows its flat version, at the same URL.
- **Project images are never relit** (Vishesh's decision, batch 06): under D50, TL84, A, UV, FLOOD and SCREEN the case-study images and videos are the plain files. Only the 3D booth changes. AFTER DARK is the one exception: the hand lamp's torch reveals them: an overlay above the untouched page images darkens everything outside the torch (smooth falloff, dithered), fully transparent in the core, so the core is the file's own pixels (multiplier exactly 1.0; no tone mapping, bloom, colour matrix or tint can reach an image).

---

## 2. Locked rules (never break these)

1. **No distortion anywhere.** No warping, displacement, RGB split, wobble or noise distortion, including hovers and transitions. Light is the only thing that changes.
2. **Never invent facts.** Every client name, year, role, award, link and claim must come from the live Framer site or from Vishesh. Where data is missing, leave it out; don't fill it in.
3. **No em dashes in any copy.**
4. **Live-site facts are authoritative.** The live site wins over drafts and over the original brief. Corrections are centralised in `content/work/corrections.ts`.
5. **Project images keep their authored colour.** No lamp relights a case-study image or video; only the booth changes. AFTER DARK's torch is a luminance mask over the untouched file, nothing more. UV notes are a caption strip under the first proof (UV lamp only), never printed on a photo. The colour bar beside each proof is that image's own palette (`content/palettes.ts`), never generic.
6. **The lamp never switches by itself.** Only the visitor changes it. Their choice is kept for the session in `sessionStorage` key `vm:lamp:v1`. A project's native lamp is offered through a chip; it is never forced.
7. **House lights is a mode, never a page.** Toggling never navigates: the current page switches between its booth and flat versions in place, URL unchanged (`<html data-house-lights>`, set before paint). Remembered only if the visitor chose it (localStorage `vm:houseLights:v2`); a first-time visitor always starts with it off. A slow GPU sets a session-only flag, `vm:autoHouseLights:v1`. `/house-lights` remains as a shareable direct link only; nothing in the UI sends visitors there.
8. **All content lives in the DOM.** The canvas is presentational and `aria-hidden`. Proof `<img>` elements stay in the DOM for SEO and accessibility even when WebGL draws over them.
9. **One idea at absurd quality.** No eighth lamp, no second gimmick (BRIEF §9 kill criteria).
10. **Ask before building.** Vishesh doesn't code and prefers to be consulted before large changes. Once a direction is given, execute it fully and report outcomes, not logs.

---

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript), React 19 |
| 3D | three 0.186, @react-three/fiber 9, @react-three/drei 10, postprocessing 6 |
| State | Zustand (`useBooth` in `lib/store.ts`) |
| Scroll | Lenis |
| Animation clock | One rAF loop, `lib/clock.ts` `addTicker`. GSAP was removed; Lenis, lamp strikes and the canvas all run on this one clock. |
| Fonts | Geist + Geist Mono, subset to Basic Latin (`app/fonts/*.woff2`, `tools/subset-fonts.sh`), loaded with `next/font/local` |
| Analytics | Vercel Analytics (`lib/analytics.ts`; `<Analytics/>` in `app/layout.tsx`) |
| Models | GLB via gltf-transform: meshopt geometry, KTX2 textures (UASTC/ETC1S). Basis transcoder in `public/basis/`. |
| Images | AVIF primary, WebP fallback |
| Sound | Fully procedural Web Audio; no audio files |
| Media hosting | Everything is in `public/` on Vercel. Cloudflare R2 (BRIEF 5.1) is not set up; it hasn't been needed. |

---

## 4. Routes

| Route | What |
|---|---|
| `/` | The booth: eight samples in four screen-space columns (a front sample with a raised one behind it), the stage spanning the content width gutter to gutter, with the headline "Tested under every light." In house lights mode: the flat project index, same URL. |
| `/work/[slug]` | The booth is a header with that sample on the tray. Below: spec plate, then the 6-image proof strip (crop marks, each image's own palette bar, frame numbers). Images are the plain files under every lamp (torch only under AFTER DARK). In house lights mode: no booth header, same content. |
| `/house-lights` | A shareable direct link to the flat index (no WebGL). No UI link points here; the `Index` nav item turns house lights on at `/`. |
| `/about` | "Certificate of Calibration", full width: two columns from 1100px (name, discipline, location, what I do, portrait · experience, education, awards, tool stack, clients), one column below. CV PDF (`/Vishesh-Mahendru-CV.pdf`) and socials. No CTA and no email block on the certificate (the email lives in the footer). |
| `/archive` | Contact sheet of 45 archive pieces. The filter is by series and is kept in `?series=`. |
| 404 | `app/not-found.tsx`: a pure-CSS UV booth. |
| `/projects/*` | 301 redirects to `/work/*` (legacy Framer URLs; `next.config.ts` `LEGACY_PROJECTS`). |

**Never name a route segment `index`.** Vercel serves `/index` from the root page. `tools/check-routes.mjs` guards this and runs before every build.

**Contact:** work@visheshmahendru.com ("Book a viewing" mailto plus a copy-email button), in the site footer only.

**Lamp panel:** a floating hardware bar fixed at the bottom right on pages with a booth (`/` and lineup project pages), folding to a pill that shows the active lamp (session-remembered, `vm:panelFolded:v1`). Phones: the bottom rail with short labels under the dots and the active lamp's name. No panel on `/about`, `/archive`, `/house-lights` or archive-only projects. Layout is full width, gutter to gutter, everywhere: no column is reserved for the panel; pages keep `--panel-clear` of space under their last content so the bar never covers it.

**Socials** (in `lib/site.ts`):
- Instagram vishafterdark
- Behance visheshmahendru
- LinkedIn visheshmahendru

---

## 5. Content

### Projects (`content/work/*.ts`, order in `content/work/index.ts`)

**Lineup, left to right:**

| Sample | Native lamp | Object in the booth |
|---|---|---|
| Too Yumm | TL84 | GLB |
| JSW Sports | D50 | GLB |
| Mitooshi | SCREEN | laptop |
| Sonde | SCREEN | tablet |
| House of Hex | SCREEN | phone on stand |
| Bengal T20 | FLOOD | procedural flag/ticket stack |
| SOOK | TL84 | GLB tea-box trio |
| SHUNYA | A | GLB, on a riser |

**Archive only:** Indo Thai (SCREEN, `inLineup: false`).

### Content pipeline

The data passes through four steps in order:

1. **Per-project file** (`content/work/<slug>.ts`): lamp, model config, scale, UV setup.
2. **`withImport`:** overlays the live Framer copy and images from `content/work/imported.ts`. Generated by `tools/import-framer.mjs`; don't hand-edit it.
3. **`correct`** (`content/work/corrections.ts`): live-site facts. The tables:
   - Disciplines and client types
   - Links: four outbound links
   - `YEAR` and the per-project files hold the live years. **The live years are: Too Yumm 2024, SOOK 2023, Indo Thai 2024, JSW Sports 2025, House of Hex 2026, Mitooshi 2026, Bengal T20 League 2026, SHUNYA 2026, Sonde 2026.** Do not change them.
   - `TEXT_FIXES`: copy corrections
   - `UV_NOTES`: the approved UV annotations, with their positions on the first proof
The approved UV notes are shown under the UV lamp as a caption strip below the first proof (`UvCaption`); they are no longer printed on any image.

### Other content files

| File | What |
|---|---|
| `content/alt.ts` | Alt text per deliverable |
| `content/about.ts` | About page facts (source text in `about.raw.md`) |
| `content/archive.ts` | Archive series labels |
| `content/masters.ts` | Generated. The list of web images that have an AVIF made from a full-colour master. |

**Archive series** (plain visual descriptions, no invented names or years):
- Posters and graphics
- CD and poster
- 3D: attic classroom
- 3D: orange coupe
- 3D: grey GT car
- 3D: studies
- 3D: retro computer
- Type posters
- Blackletter posters
- Classical statue posters

A29 was removed as a duplicate of A28.

### Data shape

The data shape is in `lib/types.ts`. Key fields:
- `slug`, `title`, `disciplines`, `clientType`, `year`, `role`, `scope`
- `nativeLamp`, `inLineup`
- `model` (GLB config)
- `uvNotes`
- `deliverables` (exactly 6; image or video, with alt, optional `inkNotes`, `fluorMask`)
- `links`

`credits` and `behance` were removed.

---

## 6. Architecture (how the booth works)

### One canvas, one clock

- **The canvas:** one fixed, full-screen, transparent `<canvas>` (`components/booth/BoothCanvas.tsx`) mounts once in `app/(site)/layout.tsx` and survives every route change.
- **The view system:** `lib/views.ts` tracks DOM rectangles (the booth stage, the proof images) with ResizeObserver and re-measures once fonts load. The canvas draws each view into its rectangle by scissoring.
- **The booth camera:** its projection spans the whole canvas via `setViewOffset`; the stage rectangle is the scissor. This keeps the booth pixel-aligned with the page. `tools/check-views.mjs` tests this: worst case 1.9px.
- **The clock:** `lib/clock.ts` drives Lenis scroll, lamp strikes and canvas frames from one rAF loop, so the proof planes never drift from the scroll (measured drift: 0px). The canvas renders on demand and pauses when idle.

### Scene (`components/booth/`)

| File | Role |
|---|---|
| `staging.ts` | Booth dimensions (1.5 × 0.8m), cove, cabinet header, hood, diffuser; the 8 samples in 3 tiers with per-sample scale and position; lens FOV 35; eye height and pitch |
| `shots.ts` | Camera shots: `cabinetShot` contain-fits the samples to the stage on any aspect ratio, with lens shift; `trayShot` for project pages |
| `CameraRig.tsx` | Smooth camera moves; pointer parallax max 1.5° (0.6° vertical) |
| `shell.ts` | Booth shell geometry (rounded boxes, second UV set for the baked AO/lightmap atlas) |
| `BoothRoom.tsx` | Shell materials, floor (reflective on desktop), diffuser, calibration props, lightmap hook |
| `ObjectSlot.tsx` | One sample: base, GLB or procedural object, contact shadow, hover lift, focus, click to open |
| `placeholders.tsx` | Procedural objects: laptop, tablet on easel, phone in stand, Bengal stack, screens |
| `models.ts` | GLB loading (KTX2 + meshopt) |
| `screens.ts` | Device screens: brand logo SVG on the brand colour (`public/brand/<slug>/logo.svg` + `bg.txt`) |
| `uvMaterial.ts` | UV fluorescence and invisible-ink shader chunk, hover rim |
| `environment.ts` | Reflection environment per lamp (PMREM) |
| `LampRig.tsx` | All seven lamp rigs, strike animation, shadow invalidation |
| `Post.tsx` | Post chain: scissored views, AgX tone mapping only inside the booth, bloom, colour matrix, grain only in the stage box, MSAA with SMAA fallback, SSAO on desktop, loupe pixel reads |
| `PerfProbe.tsx` | Frame timing, resolution step-down, slow GPU → automatic house lights |
| `BoothHost.tsx` | Mounts the canvas lazily after first paint; WebGL capability check |
| `BoothFocus.tsx`, `focus.ts` | Keyboard focus and the hover spec plate for samples |
| `ModelRef.tsx` | `?modelref=<slug>` debug view for comparing GLBs against Blender reference renders |

### Lighting details

- **Lamp presets** (`lib/lampPresets.ts`): position, colour (Kelvin via `lib/kelvin.ts`), intensity, exposure, strike channels and durations, and screen gains for each lamp. D50 exposure is 0.47, which calibrates the N5 grey patch to sRGB about 118.
- **Shadows:** PCF + drei SoftShadows (PCSS); cached contact shadows per object; SSAO at half resolution on desktop; baked AO texture (`public/booth/ao.png`) everywhere.
- **Area-light tables:** the LTC tables for RectAreaLight live in `public/booth/ltc.bin` (`lib/ltc.ts`). They were moved out of the JS bundle to fit the budget.
- **Lightmap path:** if `public/booth/lightmap.*` exists, the booth uses it automatically (resolved at build time in the site layout). It doesn't exist yet: a Blender bake from `tools/booth-shell.glb` plus `tools/camera.json` would provide it.

### Interaction and UI (`components/ui/`, `lib/`)

**UI pieces:**

| Piece | Files | Notes |
|---|---|---|
| Switch panel | `SwitchPanel.tsx` | Floating bar, bottom right; folds to a pill. Mobile: bottom rail with short labels. Only where there is a booth. |
| House lights | `lib/houseLights.ts`, `HouseIndex.tsx`, `IndexNavLink.tsx` | A mode of the page (`setHouseLightsMode`), never a navigation |
| UV caption | `UvCaption.tsx` | Approved UV notes as fluorescent-ink text under the first proof, UV lamp only |
| Native lamp chip | `NativeLampChip.tsx` | Offers a project's native lamp without forcing it |
| Spec plate | `SpecPlate.tsx` | |
| Proof strip | `ProofStrip.tsx` | Plain `<picture>` (AVIF) under every lamp, never redrawn; palette bar from `content/palettes.ts` (hover for hex) |
| AFTER DARK torch | `TorchOverlay.tsx`, `lib/torch.ts` | A 2D overlay above the page that darkens around the hand lamp (position from the lamp rig); transparent in the core, so the visitor sees the file's own pixels |
| Slug line | `SlugLine.tsx` | |
| Spectro loupe | `Loupe.tsx`, `lib/loupe.ts` | Hold Alt or press L. Reads the real pixel under the cursor and shows hex, CIE L\*a\*b\* (D50) and the lamp. Desktop with a fine pointer only. |
| Shortcuts overlay | `Shortcuts.tsx` | Press `?` |
| Notices | `Notice.tsx` | Driven by `?notice=` |
| Copy email | `CopyEmail.tsx` | |
| Outbound links | `OutboundLink.tsx` | |
| About bits | `AboutBits.tsx` | CV link, pass stamp |

**Behaviour (`lib/`):**

| Behaviour | Files | Notes |
|---|---|---|
| Transitions | `lib/navigate.ts` | View Transitions API for booth → project, plus a route crossfade |
| Resilience | `lib/resilience.ts` | Lost WebGL context or a failing GPU sends the visitor to `/house-lights?notice=...` |
| GPU and perf tiers | `lib/gpuTier.ts`, `lib/perfTier.ts` | Low tier gets plain DOM proofs |
| Reduced motion | `lib/useReducedMotion.ts` | No strikes, no parallax |

**Keyboard shortcuts:**

| Key | Does |
|---|---|
| 1–7 | Lamps |
| I | House lights |
| S | Sound |
| L | Loupe |
| ← → | Move between samples |
| Enter | Open the focused sample |
| Esc | Close |
| ? | Shortcut list |

### Sound (`lib/sound.ts`)

- Fully procedural Web Audio. Off by default; the choice is remembered (`vm:sound:v1`).
- **Beds:** one quiet bed per lamp.
- **Events:** lamp switches (one per lamp), breaker on/off, hover, select, swipe, route, stamp, paper feed, loupe, beep, toggle.
- Signal chain: master → limiter → speakers. An analyser drives the level meter.
- Pauses when the tab is hidden.

### Boot script (`app/layout.tsx`)

An inline script runs before paint. It applies the stored lamp and sets `<html data-house-lights>` from the stored preference, so every page loads straight into its flat version. It never redirects.

### Storage keys

| Key | Where | Meaning |
|---|---|---|
| `vm:lamp:v1` | session | Current lamp |
| `vm:houseLights:v2` | local | Visitor chose house lights |
| `vm:autoHouseLights:v1` | session | Slow GPU fell back automatically |
| `vm:sound:v1` | local | Sound on/off |
| `vm:stamped:v1` | session | About page stamp already played |

### URL flags (debugging)

| Flag | What |
|---|---|
| `?perf` | Frame-time and fps readout. `window.__boothPerf()` in the console. |
| `?gpu=high` / `?gpu=low`, `?tier=` | Force a GPU or perf tier |
| `?viewdebug`, `?viewdebug=cabinet` | View alignment debug overlays |
| `?lampdebug` | JSON lamp-rig report on each lamp change |
| `?exposure=` | Override booth exposure |
| `?nobloom`, `?drift` | Disable bloom; proof drift measurement |
| `?modelref=<slug>` | One GLB on grey, matching its Blender reference render |
| `?notice=` | Show a notice |

---

## 7. Assets and pipelines

| Asset | Source | Tool | Output |
|---|---|---|---|
| Project images | Framer site | `tools/import-framer.mjs` | `public/work/<slug>/NN.webp`, `content/work/imported.ts` |
| Full-colour masters | GitHub release `masters-v1` | `tools/import-masters.mjs` (perceptual-hash matching; AVIF tuned to a banding metric) | AVIF beside each WebP, `content/masters.ts`, `tools/masters-report.md` |
| Archive grid sizes | `public/archive/NN.webp` | `tools/archive-sizes.mjs` | `public/archive/sized/NN-{480,960}.{avif,webp}` |
| Proof palettes | Each case-study image (the master AVIF where one exists; a video's poster) | `tools/extract-palettes.mjs` (k-means in OKLab, area-weighted, by lightness) | `content/palettes.ts` |
| GLB models | `assets-src/models/<slug>/` (Blender exports + `.ref.png` renders) | `tools/optimize-models.mjs` | `public/models/<slug>/*.glb` (desktop + mobile variants) |
| Model check | | `tools/model-ref.mjs` | Side-by-side against the Blender reference renders |
| Booth AO and shell | Code (`shell.ts`) | `node --experimental-strip-types tools/bake-booth.mjs` | `public/booth/ao.png`, `tools/booth-shell.glb`, `tools/camera.json` |
| Blender camera | `tools/camera.json` | `tools/blender_camera.py` (run in Blender) | Matching cameras and plinths in Blender |
| Bengal textures | Project stills | `tools/crop-textures.py` | `public/booth/textures/bengal-t20/` |
| Brand screens | Manual | | `public/brand/<slug>/logo.svg` + `bg.txt` |
| LCP posters | Rendered from the booth | `tools/make-posters.mjs` + `encode-posters.py` | `public/booth/poster-*.webp`. Re-run after any visual change to the booth. |
| Blue noise | | `tools/gen-bluenoise.py` | `public/textures/bluenoise64.png` |
| Fonts | Geist | `tools/subset-fonts.sh` | `app/fonts/*-subset.woff2` |
| LTC tables | three.js | `tools/dump-ltc.mjs` | `public/booth/ltc.bin` |
| Archive dedupe | | `tools/dedupe-archive.py` | Report; removals recorded in `content/archive.ts` |

**Masters status:**
- 43 of 45 project images matched a master.
- Mitooshi 04 and 06 need no master: they are two-colour dot-pattern squares that the indexed palette does not harm.
- 44 archive masters are indexed.

**Models status:** Too Yumm, SOOK, JSW Sports and SHUNYA are real GLBs. The other four samples are built in code.

---

## 8. Budgets and measured performance

| Budget | Target | Actual |
|---|---|---|
| JS before 3D (gz) | ≤ 200 KB | 176 KB |
| 3D JS, lazy (gz) | ≤ 460 KB | 419 KB |
| Models desktop / mobile | ≤ 6 / 2.5 MB | 5.83 / 2.0 MB |
| iPhone 15 | ≥ 50 fps | Not yet measured (needs the device; use `?perf`) |

**Lighthouse** (local production build):

| Page | Speed, mobile / desktop | Other scores | Mobile LCP |
|---|---|---|---|
| /about | 94 / 100 | | |
| /house-lights | 95 / 100 | | |
| /archive | 83 / 99 | | 4.1s (was 18.9s before the responsive images) |
| All pages checked | | Accessibility 96–100, SEO 100 | |

The 3D pages can't be scored in a GPU-less container. Use PageSpeed Insights on the live URL for those.

---

## 9. Testing (run against a production build on port 3100)

```bash
npm run build && npx next start -p 3100
PLAYWRIGHT=<path to playwright> node tools/<check>.mjs
```

| Script | Checks |
|---|---|
| `check-routes.mjs` | No reserved route names (runs in `npm run build`) |
| `check-lamp.mjs` | The lamp never auto-switches; persistence; native chip |
| `check-views.mjs` | Booth/canvas alignment at 1280–2560 wide, resizes, scrollbars |
| `check-sizes.mjs` | Each sample ≥ 12% of the cabinet width; projected boxes overlap ≤ 3%; 3D gaps ≥ 6cm |
| `check-overflow.mjs` | No horizontal scroll at 390px on 13 routes |
| `check-redirects.mjs` | `/projects/*` → `/work/*` 301s |
| `check-sound.mjs` | Sound beds and events |
| `check-smear.mjs` | A1: no stale booth pixels outside the current views (scrolling, opening projects), and each route registers only its own views |
| `check-flicker.mjs` | A2: no presented frame of the booth drops > 5% below its neighbours while the pointer moves (D50, A) |
| `check-houselights.mjs` | B: house lights toggles in place, URL unchanged; stored choice loads flat; no panel on /about, /archive |
| `check-layout.mjs` | D1/D5: cabinet centred in a gutter-to-gutter stage; nav, footer and next row end on the right gutter |
| `check-switch.mjs` | A3: project-to-project timing and long tasks |
| `measure-screen.mjs` | G: object luminance under SCREEN |
| `torch-closeups.mjs`, `transition-sheet.mjs` | C2 torch close-ups (core = the file), A4 transition contact sheet |
| `metrics.mjs`, `behaviour.mjs` | JS sizes, paint timing, plane drift, video |
| `review-shots.mjs` | Screenshots of every lamp plus key pages at 1568 and 390 (`LABEL=`, `LAMPS=`, `PAGES=`) |
| `record-gif.mjs` | GIFs on a virtual clock. Not used; the GIFs were dropped. |

Gotchas when testing in the cloud container:
- Software WebGL (SwiftShader) is slow. Prefer DOM clicks or keyboard dispatch over Playwright pointer clicks.
- Never run `pkill -f` with a pattern that appears in your own command line; it kills the shell.
- Restart the server by freeing the port with `fuser -k 3100/tcp`.

---

## 10. History

| Commit | Milestone |
|---|---|
| `37e8b82` … `733efa5` | Phase 0 scaffold, Phase 1 booth + D50 + house lights |
| `34273ae` | Phase 2: lineup on plinths, all seven lamps |
| `873b1e0` … `f08887e` | Phase 3: real booth, one fixed canvas + view system + single clock, project page with lit proof strip |
| `f7a2ab1`, `90cc27f` | Framer content import |
| `4413512` … `4a92ec9` | Cabinet composition, lamp fixes, mobile perf pass, SEO, perf tier |
| `baef030` | Vishesh added the GLBs and logos |
| `ff5fc69` … `b8341b8` | The A–I batch (below) |
| `e3d6ada` | Merge of PR #1 into `main` (4 Oct 2026) |

**The A–I batch:**

| Section | What |
|---|---|
| A | Lamp never auto-switches |
| B | Image fidelity and the masters pipeline |
| C | Glitch fixes C1–C8 |
| D | Realistic 3D: GLB pipeline, AgX, environments, soft and contact shadows, SSAO, AO, 35mm lens, booth construction, staging, warm-ups |
| E | Live-site content |
| F | Archive cleanup |
| G | Logos on booth screens |
| H | Procedural sound |
| I | Transitions, loupe, 404, resilience, shortcuts, analytics, loading |

The work was done across two Claude accounts. The first session's last uncommitted work was lost when its cloud container expired, and the second session rebuilt it from the prompt. **Lesson: commit and push after every section.**

The detailed delivery report for the batch is `DELIVERY.md` in the repo.

---

## 11. Open items

1. **iPhone 15 frame rate:** check on the device with `?perf`.
2. **PageSpeed Insights** on the live booth pages (`/` and `/work/*`) for real mobile scores.
3. **Lightmap bake (optional, high impact on realism):** `tools/booth-shell.glb` and `tools/camera.json` are re-exported from the batch-06 composition. Bake a neutral-white lightmap onto TEXCOORD_1 in Blender and add it as `public/booth/lightmap.exr` (linear half float) and/or `lightmap.png` (16-bit linear) with a `lightmap.README.txt`. The next session converts it to KTX2 and wires it per lamp.
4. **More real GLBs (optional):** Bengal T20, Mitooshi, House of Hex and Sonde are procedural. Real models would go through `tools/optimize-models.mjs` (put sources in `assets-src/models/<slug>/`).
5. **UV fluorMask / uvInk textures (optional):** authored per object in Blender (BRIEF §6) for richer UV mode.
6. **Analytics:** Vercel Analytics must be enabled in the Vercel dashboard to collect data.

---

## 12. How to work on this project (for any future Claude session)

1. **Read** `BRIEF.md`, then this file, then `DELIVERY.md`.
2. **Ask before building.** Explain the plan in plain language: Vishesh doesn't code. Once approved, execute fully without stopping halfway.
3. **Branch, preview, merge.** Work on a branch and let Vercel build a preview. Merge to `main` only after a green preview, because `main` is the live site.
4. **Commit and push after each meaningful step.** Cloud containers are ephemeral.
5. **Respect the locked rules** in §2. Above all: no distortion, no invented facts, no em dashes, and the lamp never auto-switches.
6. **Verify before claiming.** Run the checks in §9, take screenshots at 1568 and 390, and report honestly what was verified only in software rendering.
7. **Report outcomes, not logs.** Keep reports short and decision-oriented.
