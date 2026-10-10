# visheshmahendru.com: The Booth. Full project context

This document holds everything needed to pick the project up cold, by you or by a new Claude session. It is current as of 8 Oct 2026, after batch 09B (PR #8: the layout chosen by screen shape, switched live, and the shelf on tall screens), on top of 09A (PR #7). `HANDOVER.md` has the session wrap-up; `DELIVERY-09B.md` and `DELIVERY-09A.md` the batch reports.


09B owner corrections and final verification are recorded in `DELIVERY-09B.md`: the exact About caption with the photo unchanged, tablet-only band fitting below aspect 1.5, four desktop fit checks, the tablet laptop visibility gate, and phone hint clearance. Shelf geometry moved into `shelfGeometry.ts` so initial sizing code does not load Three.js; the generated shelf meshes were verified byte-for-byte identical. The stage ignores pointer events outside its canvas so Index / 3D viewport UI clicks cannot activate scene links. All 63 poster/share-card files came from one unfiltered render. The gated build, 20 regression tools and three delivery/report tools passed under SwiftShader. After the history-preserving PR #8 merge, changes go directly to `main`, with passing build/checks before push and a complete poster re-render in every commit that changes the first frame. Real-device performance remains unmeasured.

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
| `/` | One centred column: the headline "Tested under every light.", the subtext, the booth (nine samples plus the About certificate on the shelf), the lamp panel in the flow under it. Stage width = min(content width, 1.6 × the height left), so booth and panel fit one screen. Phones (< 600px) have their own portrait shot (the cabinet's height fills a 4:5 box), swiped sample to sample. The nav's first item swaps the home view in place (URL unchanged): **Index** (a clean list: number, project, discipline, year, image preview on hover) ⇄ **3D viewport**. In house lights mode: the flat house-lights index, same URL. |
| `/work/[slug]` | 09A: until the booth is live, the header shows that sample's own tray poster (`public/booth/tray/<slug>[-phone].webp`, P2). The title block and calibration label are sticky from 1100px (P6). The outbound link is a filled button ("View live site ↗" / "Read full case study on Behance ↗", G) inside the label and again at the end; the ending is two cover cards (previous / next, P7). Sections reveal by opacity once (P9). The booth header (≥ 62svh desktop, ≥ 48svh phone, starting under the masthead) with that sample on the tray; drag (or ← → on the focused header) turns it. Below, the story: title block on the calibration label (left) beside M1 (right, tops aligned); P1 centred (~62ch); M2 + M3 side by side; P2 + P3 side by side; then the rest in a grid. The live link ("Live site ↗" / "Full case study ↗") is a row inside the calibration label (Mitooshi, Sonde, House of Hex, Indo Thai only). Ending: the outbound link again, then the previous and next projects as cover cards, wrapping round the lineup (P7). Images are the plain files under every lamp (torch only under AFTER DARK). In house lights mode: no booth header, same content. |
| `/house-lights` | A shareable direct link to the flat index (no WebGL). No UI link points here. House lights is only the rocker / I; the nav's Index is a separate home view. |
| `/about` | "Certificate of Calibration", full width: two columns from 1100px (name, discipline, location, what I do, portrait · experience, education, awards, tool stack, clients), one column below. LOCATION reads "India" plus a live IST clock (24h, ticks each minute, client-only). No "checked under" / PASS strip. CV PDF (`/Vishesh-Mahendru-CV.pdf`) and socials. No CTA and no email block on the certificate (the email lives in the footer). |
| `/archive` | 09A P11: every tile has its dominant colour and a 16px blur-up until the image lands (`content/archive-lqip.json`, `tools/archive-lqip.mjs`), and opens a viewer (arrows, swipe, Esc, focus trapped, `#A07` hashes shareable). Contact sheet of 49 pieces (45 stills + 4 AMG GTR clips that loop muted only on screen), titled by Vish's A-number list (`content/archive.ts` `TITLES`), numbered A01–A49 with no gaps. One row of chips (All · Music cover art · 3D explorations · Posters · Other), kept in `?series=`. |
| 404 | `app/not-found.tsx`: a pure-CSS UV booth. |
| `/projects/*` | 301 redirects to `/work/*` (legacy Framer URLs; `next.config.ts` `LEGACY_PROJECTS`). |

**Never name a route segment `index`.** Vercel serves `/index` from the root page. `tools/check-routes.mjs` guards this and runs before every build.

**Contact:** work@visheshmahendru.com. Every "Book a viewing" link (masthead button, footer closing block, 404) is the one helper `contactMailto()` in `lib/site.ts`: a standard `mailto:` with the agreed subject ("Saw your portfolio, let's connect") and body, CRLF-encoded; `check-07` asserts every mailto on the site matches it. The footer ends every page with the closing block (M3, 09A): the email set large, a copy button, the time in India, the three socials. The masthead carries Index/Home, About, CV and a filled "Book a viewing" button (P4).

**Lamp panel:** on `/` it sits in the flow, centred under the booth (portalled into `#panel-slot`). On project pages it is a small centred pill (dot + lamp name, crossfading 150ms on a change) plus an always-present house-lights switch ("I · BOOTH/FLAT", 09A F1/P3) that opens on hover or click. Lamp changes are announced in an aria-live region (P8). While the booth header is on screen it rides the header's bottom edge; below that it slides away while scrolling down and returns on scroll up or after 1.2s still, never over a proof (08 H3, `SwitchPanel.tsx`). Pages keep `--panel-clear` of space under their last content. No panel on `/about`, `/archive`, `/house-lights`.

**Socials** (in `lib/site.ts`):
- Instagram vishafterdark
- Behance visheshmahendru
- LinkedIn visheshmahendru

---

## 5. Content

### Projects (`content/work/*.ts`, order in `content/work/index.ts`)

**Lineup (all nine projects are in the booth; content order in `content/work/index.ts`):**

| Sample | Native lamp | Object in the booth | Where |
|---|---|---|---|
| Too Yumm | TL84 | GLB pouch | front row, far left |
| Bengal T20 | FLOOD | GLB flat set on its own sloped wedge | front row |
| SOOK | TL84 | GLB tea-box trio | front row |
| SHUNYA | A | GLB four pieces, on the clear riser with a dark backing board | front row |
| House of Hex | SCREEN | GLB phone on stand (logo on its screen) | front row, far right |
| Mitooshi | SCREEN | GLB laptop (logo on its screen) | raised middle tier, left |
| Indo Thai | SCREEN | GLB aircraft pushback tug | raised middle tier, centre |
| Sonde | SCREEN | GLB tablet (logo on its screen) | raised middle tier, right |
| JSW Sports | D50 | GLB coffee-table book, closed; it opens (clip `open`, 900ms eased) on the tray | back, high plinth |

Plus the **About certificate** (black satin frame, glass, matte paper: "CERTIFICATE OF CALIBRATION", "VM BOOTH 01", "Vishesh Mahendru") on the shelf, top right; click → `/about`, hover → "About". Rules (tools/check-sizes.mjs): every sample ≥ 11% of the cabinet width, projected boxes overlap ≤ 3%, ≥ 8cm clear between any two.

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
| `staging.ts` | Booth dimensions (1.5 × 0.8m), cove, cabinet header (4.5cm since 08), hood, diffuser; the 9 samples at one display scale (K = 1, real size; the Indo Thai tug is a 1:24 model with an engraved plate) in 3 tiers; SHUNYA's N5.5 sweep card on a high riser; the size rule (`sizeFloor`: long side ≥ 11% of the cabinet, 9% on a raised plinth with nothing taller in front); JSW's open box on the tray (`trayBox`); the certificate; lens FOV 35; eye height and pitch. 09B: a registry of arrangements (`wide`, `square`, `shelf2`, `shelf3`, `shelf4`); `STAGING`, `PROPS` and `CERTIFICATE` are live views of the active one (`setActiveLayout`, `layoutKeyFor(shape, columns, route)`). A sample may stand on a raised floor (`y`, a shelf board) on no base (`kind: 'none'`) |
| `phoneStaging.ts` | G (08): the gathered arrangement, all ten objects in three tiers in the middle of the cabinet at 0.68 × real size. 09B: used as `square`, the cabinet behind the project tray on tall and square screens |
| `shelf.ts`, `ShelfUnit.tsx` | 09B: the wall shelf (tall: 2 columns under 600px, 3 from 600px; square: 4 columns, 3 tiers), in the booth's N8/N8.5 materials, outside the frozen room file: its rows (`ROWS2/3/4`), geometry with its own uv1 atlas, an engraved label rail under every sample, the certificate in its own slot, the tug on a low plinth with its plate. AO: `public/booth/ao-shelf{2,3,4}.png` (`tools/bake-shelf.mjs`). Not locked yet: `SHELF_LOCK=1 node --experimental-strip-types tools/bake-shelf.mjs` writes `tools/booth-shelf.lock` once Vishesh approves the shelf |
| `layoutSwitch.ts`, `useLayout.ts` | 09B: every change of arrangement goes through `requestLayout`; the canvas's `LayoutGate` (in `BoothCanvas.tsx`) copies the frame on screen into a 2D canvas over the WebGL one (once, GPU side, the moment before the page changes), applies the new arrangement, waits for its tree, its AO map and its shaders, draws one full frame under the cover, then crossfades 250ms (none under reduced motion). Route-driven switches fade the canvas in instead |
| `shots.ts` | Camera shots: `cabinetShot` contain-fits the cabinet to the stage, with lens shift; `trayShot` for project pages; `trayHidden` (F1, 08): which neighbours drop out of a tray shot. 09B: `shelfShot`, the scroll-linked dolly: no pitch, the camera at the viewport's centre and at the distance where the shelf's front edges span the frame, so the front plane moves with the page exactly and deeper things a little less; under reduced motion a fixed pose per shelf (the nearest row) and a plain lens shift. `clearShotCaches` on every switch |
| `CameraRig.tsx` | Smooth camera moves; pointer parallax max 1.5° (0.6° vertical) |
| `shell.ts` | Booth shell geometry (rounded boxes, second UV set for the baked AO/lightmap atlas) |
| `BoothRoom.tsx` | Shell materials (N8 walls), floor (reflective on desktop), diffuser, lightmap hook; the cabinet's solid parts are picking occluders |
| `ObjectSlot.tsx` | One sample: base, GLB, Bengal's wedge, SHUNYA's sweep card, the tug's scale plate, contact shadow (re-bakes crossfade over 200ms), late-model fade-in (250ms), hover lift, turntable (drag / keys, inertia), JSW's open clip, tray-shot hiding, pickability (≥ 60% in view), click to open |
| `Certificate.tsx` | The About certificate on the shelf, under its own soft spot (room lamps) |
| `HoverLight.tsx` | D (08): a soft extra key (+12%) on the hovered sample, ramping with the focus; always in the scene at intensity 0 so nothing recompiles |
| `models.ts` | GLB loading (KTX2 + meshopt) in view-priority order: the tray object first, then the lineup left to right, the rest when idle (phones: after the first scroll or touch) |
| `deviceScreen.ts`, `screens.ts` | A device GLB's `screen` mesh: the brand logo on its `bg.txt` colour by UV0, a glass coat with fingerprints, an area light the size of the display (desktop) |
| `imperfections.ts` | Fingerprints and scratches (acrylic, glass, screens), paper fibre normal, wiped wall roughness |
| `uvMaterial.ts` | UV fluorescence and invisible-ink shader chunk, hover rim |
| `environment.ts` | Reflection environment per lamp (PMREM): the real booth interior, captured on the GPU the first time each lamp is on screen with the rig at that lamp's full output (desktop, cached per lamp); a built stand-in on phones |
| `LampRig.tsx` | All seven lamp rigs, strike animation, shadow invalidation |
| `Post.tsx` | Post chain: scissored views (full MSAA resolve only when the view rects change), tone mapping only inside the booth (PBR Neutral for D50 / TL84 / A, AgX for the dark lamps), a gentle stage vignette, masked hover focus (D 08: a half-resolution mask of the hovered sample, ≤ 2.5px blur outside it at 1440p, 250ms in / 300ms out; replaces depth of field), bloom, colour matrix, grain only in the stage box, MSAA 4x (SMAA crawls on the frame chamfers), SSAO normals re-rendered only on change, loupe pixel reads; `?perf` per-pass profiler |
| `PerfProbe.tsx` | Frame timing, resolution step-down, slow GPU → automatic house lights |
| `BoothHost.tsx` | Mounts the canvas lazily after first paint; WebGL capability check. C (08): the poster (in `BoothFrame`) stays until the visible models are in, the lamp's environment is captured and one full frame has rendered (`lib/reveal.ts`), then crossfades over 300ms |
| `lib/dirty.ts` | B (08): dirty flags per system (reflector, shadow, normals). The floor reflection, shadow map and SSAO normals re-render only when the camera, lamp, an object, the view, the DPR or a model load changes them; shown in `?perf` |
| `BoothFocus.tsx`, `focus.ts` | Keyboard focus and the hover spec plate for samples |
| `ModelRef.tsx` | `?modelref=<slug>` debug view for comparing GLBs against Blender reference renders |

### Layout by shape (09B)

- **`lib/shape.ts`** is the single source: `wide` (aspect ≥ 1.3), `square` (0.88 to 1.3), `tall` (< 0.88), `phone-landscape` (wide with an svh height under 480). Aspect = visual viewport width / small viewport height (100svh: toolbars shown), so a collapsing toolbar never changes it. ±0.04 hysteresis; recomputed on resize / orientationchange, debounced 150ms, only on a > 2% change. `?shape=` forces one. The pre-paint script (`shapeBootScript`, the same function's source) sets `<html data-shape data-columns>`; the shape, aspect and columns show in the `?perf` readout.
- **What each shape gets on home:** wide → the 09A cabinet and panel fitted to the first screen from aspect 1.5; below 1.5, tablet aspects keep side bands ≤ 3% and a docked panel until its place under the cabinet scrolls in. Phone-landscape → the cabinet in the full height, the headline in the masthead row, the panel a rail along the bottom; square → the 4-column shelf, whole; tall → the 2 or 3 column shelf, taller than the screen, scrolled with the page. Project pages on tall and square screens use the `square` cabinet behind the tray (taller header on phones).
- **Posters:** one per shape and lamp state (`tools/poster-matrix.mjs`), picked before first paint by an inline script (`BoothFrame`, `BoothHost` for the tray), so no poster-to-layout jump. Shelf posters cover the whole shelf. Re-render all home, dark, tray and share-card outputs together with `node tools/make-posters.mjs` after any first-frame change.
- **09B corrections:** on the three-column shelf, Mitooshi sits 5.5cm farther forward so the divider and label rail do not hide its silhouette. `check-shapes` requires at least 80% visible at 1032x1230, checks the phone hint sits above the shelf, and checks desktop cabinet plus panel fit at all four delivery sizes. The phone hint has a reserved 40px gap above the frame. The About portrait caption is "Specimen · black and white"; its image is unchanged. The cabinet lens is anchored to the 09A 1568x980 reference frame, so resizing its fitted frame does not change camera distance or the proportions shown by its poster. Both desktop fit and the tablet band rule remain in `BoothFrame`. The frame fit reads the live small-viewport height while shape classification is debounced, avoiding a fit that combines the new width with the previous height. A resize updates projection and lens shift together, while route changes retain the camera dolly. Camera projection, renderer size and post-processing targets use live canvas dimensions before each draw, so an asynchronous R3F size commit cannot leave them on different viewport sizes. The transition cover stays until the live canvas is fully opaque. Environment warm-up waits for the active lamp capture and the visible models, including their late-arrival fades. This prevents the safety reveal from caching D50 before a slow renderer has loaded the lineup. Poster generation and comparison wait for `__boothSettled`, beyond the safety reveal, before capturing.
- **On the shelf:** tap opens; a sideways drag turns a sample (the first 8px decide: mostly sideways turns it, anything else scrolls; `touch-action: pan-y`); the lamp panel floats (rail on phones, pill on tablets) and steps away from the engraved labels and from the sample under a finger; keyboard ↑ ↓ follow the shelf's order and scroll the sample into view.

### Lighting details

- **Lamp presets** (`lib/lampPresets.ts`): position, colour (Kelvin via `lib/kelvin.ts`), intensity, exposure, strike channels and durations, and screen gains for each lamp. B5 (07): D50 exposure 0.635 under PBR Neutral puts the back wall at L* ~80 and white paper at L* ~90 (`tools/measure-brightness.mjs`); TL84 and A scaled by the same factor.
- **Opening moment:** first visit per session the booth comes up dark and the D50 tubes strike (two flickers, ~1.2s; `prepareOpening` / `runOpening` in `lib/lampController.ts`). Skipped on repeat visits, reduced motion and house lights.
- **Shadows:** VSM (08; softness baked into the map, re-rendered only on change; `no=vsm` restores PCF + PCSS); cached contact shadows per object; SSAO at half resolution on desktop; baked AO texture (`public/booth/ao.png`, phones `ao-phone.png`) everywhere.
- **SCREEN lamp (09A E):** desktop gives each display its own area light (laptop blue, tablet indigo, phone orange pools), in the scene only under SCREEN (hidden, not at 0, under every other lamp); the SCREEN shader variant is compiled while idle after its environment capture. Phones keep one combined light. Pouch / book / SOOK read 24.4 / 23.3 / 21.3 L*. `?perf&no=screenlights` falls back to the combined light.
- **Screens:** glass coat at roughness ~0.12, env 0.35, no direct specular from the lamps (no hot spot).
- **Area-light tables:** the LTC tables for RectAreaLight live in `public/booth/ltc.bin` (`lib/ltc.ts`). They were moved out of the JS bundle to fit the budget.
- **Lightmap (09A C):** Vishesh's Cycles bake (diffuser, direct + bounce, neutral white; source `assets-src/booth/lightmap.exr` + its 16-bit PNG twin) ships as `public/booth/lightmap.ktx2` (2048, UASTC with sRGB transfer, 818KB, desktop) and `lightmap-phone.webp` (1024, 11KB, phones); `tools/encode-lightmap.mjs` makes both. Each lamp's `bake` level in `lampPresets` tints and scales it (the diffuser colour for D50/TL84, the key colour for A/FLOOD, near zero for UV, zero for SCREEN and AFTER DARK), struck with the opening like every other light. On room surfaces the bake replaces the realtime ceiling panel and the hemisphere bounce (shader patch in `BoothRoom.applyLightmap`); objects keep every realtime light. The reveal waits for it (`holdModels`). Loupe: D50 wall L* 79.2, paper 90.0.
- **Room normals (09A C4):** the `interior` faces into the booth now (FrontSide); positions and both UV sets are byte-identical to aa0e153 (`tools/booth-room.lock` notes it). The hood is drawn 2.2% wider so its ends hide in the coved corners (C5).

### Interaction and UI (`components/ui/`, `lib/`)

**UI pieces:**

| Piece | Files | Notes |
|---|---|---|
| Switch panel | `SwitchPanel.tsx` | Home: in the flow under the booth. Project pages: a floating centred pill that opens on hover / click. Only where there is a booth. |
| Site nav | `SiteNav.tsx`, `HomeIndex.tsx` | "Index" ⇄ "3D viewport" on `/` (store `homeIndex`, `<html data-home-index>`); "Home" elsewhere |
| House lights | `lib/houseLights.ts`, `HouseIndex.tsx` | A mode of the page (`setHouseLightsMode`), never a navigation |
| Turntable | `lib/spin.ts`, `TrayTurn.tsx` | Drag ≥ 6px turns a GLB about its vertical axis (inertia; none under reduced motion); ← → 15° on the focused sample or the project header; reset on route change |
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
| About bits | `AboutBits.tsx` | CV link, IST clock |

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
| ← → | Turn the focused sample 15° (home) or the tray object (project header focused) |
| ↑ ↓ | Move between samples |
| Enter | Open the focused sample |
| Esc | Close |
| ? | Shortcut list |

### Sound (`lib/sound.ts`)

- Fully procedural Web Audio. Off by default; the choice is remembered (`vm:sound:v1`).
- **Beds:** one quiet bed per lamp.
- **Events:** lamp switches (one per lamp), breaker on/off, hover, select, swipe, route, paper feed, loupe, beep, toggle.
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
| `vm:opened:v1` | session | The opening strike has played (09A: the opening plays on `/` only; a deep link into a project shows the lit tray at once) |
| `vm:hint:v1` | session | The first-visit wayfinding line has been shown (P5) |

### URL flags (debugging)

| Flag | What |
|---|---|
| `?perf` | Frame-time and fps readout with the dirty flags, `window.__boothPerf()`, `window.__boothPasses(n, moving)` per-pass timings (still or every system forced); the only mode with GPU readbacks (besides the loupe). `?perf&no=ssao,vsm,pcss,screencombine,screenlights,reflector,msaa4,msaa,focus,contact,envcapture,bloom` switches features off |
| `?perf&events` | On-screen event log (reveal, lamp, dirty re-renders, contact re-bakes, focus, clock state) |
| `?tone=agx` / `?tone=neutral` | Force one tone map |
| `?gpu=high` / `?gpu=low`, `?tier=` | Force a GPU or perf tier |
| `?viewdebug`, `?viewdebug=cabinet` | View alignment debug overlays |
| `?lampdebug` | JSON lamp-rig report on each lamp change |
| `?exposure=` | Override booth exposure |
| `?nobloom`, `?drift` | Disable bloom; proof drift measurement |
| `?modelref=<slug>` | One GLB on grey, matching its Blender reference render |
| `?notice=` | Show a notice |
| `?type=a\|b\|c` | 09A M4: the home headline in Antonio / Instrument Serif / Archivo Expanded (default Geist) |
| `?modelref=<slug>&yaw=&elev=` | 09A: orbit the model-reference camera (a 3/4 view, or the back with yaw 180) |

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
| Booth AO and room | Code (`shell.ts`) | `node --experimental-strip-types tools/bake-booth.mjs` (`LAYOUT=phone` for `ao-phone.png`) | `public/booth/ao.png`, `tools/booth-room.glb` (room only, UV1; FROZEN by `tools/booth-room.lock`, override with `ROOM_UNFREEZE=1`), `tools/camera.json` |
| Responsive proofs | `public/work/<slug>/NN.webp` (+ master AVIF) | `tools/proof-sizes.mjs` | `public/work/<slug>/sized/NN-{640,1200,1800,2400}.{avif,webp}`, `content/sizes.ts` |
| Mitooshi loops, AMG clips | `assets-src/mitooshi/*.gif`, `assets-src/archive/amg-gtr/*.mp4` | ffmpeg (H.264 + VP9, posters) | `public/work/mitooshi/04-05.*`, `public/archive/clips/` |
| Blender camera | `tools/camera.json` | `tools/blender_camera.py` (run in Blender) | Matching cameras and plinths in Blender |
| Brand screens | Manual | | `public/brand/<slug>/logo.svg` + `bg.txt` |
| LCP posters | Rendered from the live booth (cabinet frame crop; phone 4:5) | `tools/make-posters.mjs` | `public/booth/poster-cabinet-*.{webp,jpg}`, `poster-phone.webp`, `posters.json`. The build refuses stale posters (`tools/poster-hash.mjs --check`): re-run after any booth change. |
| Proof audio | ffprobe | `tools/probe-audio.mjs` (runs in the build) | `content/audio.json`: "Play with sound" only for videos with an audio stream |
| Blue noise | | `tools/gen-bluenoise.py` | `public/textures/bluenoise64.png` |
| Fonts | Geist | `tools/subset-fonts.sh` | `app/fonts/*-subset.woff2` |
| LTC tables | three.js | `tools/dump-ltc.mjs` | `public/booth/ltc.bin` |
| Archive dedupe | | `tools/dedupe-archive.py` | Report; removals recorded in `content/archive.ts` |

**Masters status:**
- 43 of 45 project images matched a master.
- Mitooshi 04 and 06 need no master: they are two-colour dot-pattern squares that the indexed palette does not harm.
- 44 archive masters are indexed.

**Models status (09A):** all nine are real GLBs, desktop 5.27MB / mobile 1.86MB. Desktop artwork is WebP (3 to 5x smaller than UASTC at the same look), ORM and normal maps KTX2 ETC1S; phones WebP throughout. `optimize-models.mjs` also drops extra Blender scenes, turns a backward `screen` plane to the front (Mitooshi), and nudges parts 0.3 to 0.5mm apart where two sat within 0.5mm (`NUDGE`). SHUNYA is capped (1536/1024 desktop, 768/256 phone) and decimated (17k / 6.7k triangles). Mobile uses WebP, so phones never load the Basis transcoder. All model artwork gets 8× anisotropic filtering. The JSW inner pages carry an authored layout grid in the texture. No procedural objects remain.

---

## 8. Budgets and measured performance

| Budget | Target | Actual |
|---|---|---|
| JS before 3D (gz) | ≤ 200 KB | 181.6 KB (08) |
| 3D JS, lazy (gz) | ≤ 460 KB | 427.3 KB (08) |
| Models desktop / mobile | ≤ 6 / 2.5 MB | **8.77 (over)** / 2.22 MB (08). SHUNYA 2.09 and Bengal 1.47MB are the heaviest |
| Frame at 1440p, desktop GPU | p50 ≤ 8ms, p95 ≤ 11ms | 07 measured 13.1ms on the RTX 4070 SUPER; 08 not yet measured (`?perf`, `__boothPasses(30)` and `(30, true)`) |
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

Batch 10 check tiers run against the production server on port 3100. The runner starts it if the port is free. After changing files under `public/`, restart an already running server before checking the new bytes.

| Command | When to run | Coverage |
|---|---|---|
| `npm run check:fast` | Quick smoke check | TypeScript, routes, poster hash gate, shape classification, targets at desktop and phone sizes, redirects. Target under three minutes in software rendering. |
| `npm run check:affected` | After each step | Fast tier plus checks mapped to changed files in `tools/checks-map.json`. An unmapped file invokes the full tier. |
| `npm run check:full` | Before a batch ends or when a first-frame input changes | Every regression check and the complete viewport matrices, with independent checks run concurrently. `JOBS=3` is the default. |

The runner prints per-tool seconds and writes `suite.log`; `--bail` stops scheduling new checks after a failure. `GL=soft` uses SwiftShader; `GL=gpu` requires a verified hardware renderer and refuses software fallback. `TIMEOUT_MS` overrides the normal 300-second software and 90-second GPU waits. Keep `npm run build` green before pushing to `main`.

```bash
npm run build && npx next start -p 3100
PLAYWRIGHT=<path to playwright> node tools/<check>.mjs
```

| Script | Checks |
|---|---|
| `check-routes.mjs` | No reserved route names (runs in `npm run build`) |
| `check-lamp.mjs` | The lamp never auto-switches; persistence; native chip |
| `check-views.mjs` | Booth/canvas alignment at 1280–2560 wide, resizes, scrollbars |
| `check-sizes.mjs` | Each sample's long side ≥ 11% of the cabinet width (9% raised, nothing taller in front); boxes overlap ≤ 3%; 3D gaps ≥ 8cm. Phones (390x844, 430x932): ≥ 14% of the box width, all in frame, gaps ≥ 5cm |
| `stage-plan.mjs` | Offline staging planner, no browser (`PHONE=1` for the phone arrangement) |
| `check-poster.mjs` | The poster picked by each shape matches the settled live booth (≤ 2.5% mean difference), including light and first-visit states and all 36 project tray posters |
| `check-shape.mjs` | Boot and runtime classification at 20 viewports, toolbar stability, threshold hysteresis and tablet rotation |
| `check-shapes.mjs` | Every sample inside its frame and above its size floor, shelf overlaps ≤ 3%, no horizontal scroll, panel clear of labels and 600 picking probes per viewport; also desktop first-screen fit, phone hint clearance and ≥ 80% Mitooshi visibility at 1032x1230 |
| `shots-09b.mjs` | Home first-screen and scrolled shelf screenshots across the delivery matrix; Sook and About at four viewports |
| `check-picking.mjs` | B4: on every booth route, a grid of points: what a click opens is what is seen there |
| `check-07.mjs` | Nav labels and the home view switch, IST clock, no Mitooshi 04–07 leftovers, archive titles and numbering, chips |
| `measure-brightness.mjs` | B5 loupe readings (wall and paper L*) per lamp |
| `frame-budget.mjs` | H2 per-pass timings at 2560×1440 and the mobile tier |
| `shots-07.mjs` | K5 screenshots and the JSW opening sheet |
| `check-overflow.mjs` | No horizontal scroll at 390px on 13 routes |
| `check-redirects.mjs` | `/projects/*` → `/work/*` 301s |
| `check-sound.mjs` | Sound beds and events |
| `check-smear.mjs` | A1: no stale booth pixels outside the current views (scrolling, opening projects), and each route registers only its own views |
| `check-coplanar.mjs` (09A B1) | No two separate parts within 0.5mm, facing the same way, where a booth or tray camera sees them (`node --experimental-strip-types`); fails the 08 House of Hex. Overlaps inside one part are listed for Blender |
| `mesh-clearance.mjs` (09A H3) | SHUNYA's pieces ≥ 2mm apart (runs inside `check-sizes`) |
| `check-pill.mjs` (09A F3/P4) | The pill never over the label, a proof, a link button or end card while scrolling every project page; the masthead never collides with itself at 390–2560 |
| `check-targets.mjs` (09A P1) | Targets ≥ 24px (mouse) / 44px (touch), type ≥ 11px desktop / 12px phones |
| `check-axe.mjs` (09A P8) | axe-core WCAG A/AA on every route at 1568 and 390: no serious or critical |
| `check-about.mjs` (09A J) | The About record column ends level with the portrait caption at 1440–2560; client columns 4/3/2 |
| `type-sheet.mjs` (09A M4) | Contact sheet of the headline in Geist and `?type=a|b|c` |
| `check-flicker.mjs` | A2/C7: no presented frame drops > 5% below its neighbours: reveal (poster vs live ≤ 4%; fails 07's stale poster at 44%), hover on/off every sample (D50, A), lamp change, turntable spin + release, JSW open (`ONLY=` to pick) |
| `shots-08.mjs`, `tray-zoom.mjs`, `jsw-compare.mjs` | Batch screenshots, the first-visit reveal sheet (poster → crossfade → strike, held with `__boothStrikeHold`), every model at tray zoom, JSW vs the Blender reference |
| `check-houselights.mjs` | B: house lights toggles in place, URL unchanged; stored choice loads flat; no panel on /about, /archive |
| `check-layout.mjs` | C2/D5: centred stage = min(content, 1.6 × height left), booth and panel in one screen; nav and footer end on the right gutter |
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
| `c8c4b85` | Batch 07 (PR #3): all ten objects, centred layout, project story, interaction, realism, speed |
| `aa0e153` | Batch 08 A: the room FROZEN (`tools/booth-room.lock`) |
| PR #7 | Batch 09A: integration (repaired models, lightmap, covers), screen flicker guard, lightmap on, SCREEN pools, booth tweaks, the experience pass (P1–P12), polish (M1–M5), LAUNCH.md. See `DELIVERY-09A.md` |
| PR #4 | Batch 08: frame budget (re-render on change), no flicker (live posters, gated reveal, flicker-free lamp changes), masked hover focus, true relative scale, tray framing, phone arrangement, polish. See `DELIVERY-08.md` |

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

1. **Read** `BRIEF.md`, then this file, then `HANDOVER.md`, then the latest `DELIVERY-0N.md`.
2. **Ask before building.** Explain the plan in plain language: Vishesh doesn't code. Once approved, execute fully without stopping halfway.
3. **Work directly on main after 09B.** The owner requested one final history-preserving merge of PR #8, followed by direct commits to `main`. Do not create a new branch unless the owner changes that instruction.
4. **Commit and push after each meaningful step, only while build and checks pass.** Cloud containers are ephemeral. Never push to `main` with a failing `npm run build` or check. Any first-frame change must include a full poster re-render in the same commit.
5. **Respect the locked rules** in §2. Above all: no distortion, no invented facts, no em dashes, and the lamp never auto-switches.
6. **Verify before claiming.** Run the checks in §9, take screenshots at 1568 and 390, and report honestly what was verified only in software rendering.
7. **Report outcomes, not logs.** Keep reports short and decision-oriented.
