# Delivery report: batch 07

Covers all ten objects, the centred layout, the project page story, interaction, realism and speed.

Work is on branch `claude/session-access-question-dqidr4`. Screenshots are in `booth-07.zip`; every tool named here is in `tools/`. All browser checks ran in software rendering (SwiftShader, no GPU), so anything that depends on real GPU timing is marked as such.

## 1. Tests (K1)

| Check | What it proves | Result |
|---|---|---|
| `check-07` (new) | Nav: Index ⇄ 3D viewport in place on `/`, "Home" elsewhere; IST clock; no Mitooshi 04–07 leftovers; archive titles, numbering, clips, chips | **PASS**, 21 of 21 |
| `check-picking` (new, B4) | A 40×24 grid on `/` and all nine project pages at 1568 and 390: a click opens only what is seen there | **PASS**, every point (fixed from 538 bad points: hidden samples, stale GLB matrices, walls and tray not blocking) |
| `check-sizes` (B3) | Every sample ≥ 11% of the cabinet, projected overlap ≤ 3% (certificate included), ≥ 8cm clear | **PASS**: smallest 11.7% (Too Yumm at 2560), worst overlap 1.1% (725), minimum gap 8.3cm |
| `check-layout` (C1, C2) | Centred stage = min(content, 1.6 × height left); booth and panel in one screen at 725, 1024, 1568, 1920, 2560×1440; phone crop covers its box | **PASS**, 43 of 43 |
| `check-houselights` | I / the rocker toggle in place, URL unchanged; stored choice loads flat; no panel on /about, /archive | **PASS**, 18 of 18 |
| `check-lamp` | The lamp never switches by itself; the visitor's pick persists | **PASS**, 14 of 14 |
| `check-sound`, `check-overflow` (13 routes at 390), `check-redirects` | | **PASS** |
| `check-views` | The booth drawn on its DOM rect, including after a window resize | **PASS**, 12 of 12 (worst 2.5px at 2560, within its 0.1%-of-width tolerance; 2px below 2000px wide) |
| `check-flicker` | No dark frames while the pointer moves | **PASS**: D50 worst drop 0.5%, A 0.8%. It had failed under A (a 10.6% step): the new interior capture (J2) landed 0.4s after the lamp warmed up. The capture now happens on the lamp's first frame, at its full output. |
| `check-switch` | Project to project | **PASS**: next on the tray → URL in 181ms; a header sample → URL in 123ms; no long tasks |
| Typecheck, production build | | **PASS** |

## 2. Speed (H)

**H1, readbacks.** Production does no GPU readback unless `?perf` is on or the loupe is held:
- the presented-frame luminance capture runs only under `?perf`;
- the lamp rig's diagnostic readback runs only under `?lampdebug` (it ran on every FLOOD frame before);
- the canvases that build textures are created with `willReadFrequently`, which was the likely source of Chrome's "GPU stall due to ReadPixels" warning.

**H2, frame budget.** `tools/frame-budget.mjs` times each pass on its own, closing each with a 1px sync, so each number is that pass's own cost. Software rendering is CPU-bound, so these are relative shares, not GPU milliseconds. The ≤ 8ms (2560×1440) and ≤ 16ms (mobile) targets have to be read on the RTX with `?perf` and `window.__boothPasses(30)`.

| Configuration (SwiftShader, CPU) | Frame p50 | Share saved by turning it off |
|---|---|---|
| Desktop 2560×1440, everything on | 11.2 s | |
| MSAA off | 8.8 s | **21%** |
| Device-screen area lights off | 9.3 s | **17%** |
| Floor reflection off | 10.5 s | 7% |
| Soft shadows (PCSS) off | 10.8 s | 4% |
| SSAO off | 11.0 s | 2% |
| Bloom off | 11.2 s | 0% (it is skipped when its intensity is 0, as under D50) |
| Contact shadows off | 11.7 s | none (noise) |
| Phone tier 390×844 @2x, everything on | 2.0 s | |

By pass at 2560 (everything on):
- drawing the booth (ViewsPass): 88%;
- the effect pass: 4.5%;
- the sanitize copy: 2.8%;
- scene prep (reflector, contact shadows, shadow map): 3.7%;
- the normal and coverage passes: under 1% each.

**What I cut on this evidence:**
- **Nothing yet.** These are CPU timings, where vertex and fragment work scale very differently from a GPU.
- **Measure on the RTX:** if `?perf` shows the frame over 8ms at 1440p, the first two to drop are MSAA (fall back to SMAA) and the per-screen area lights (one combined light, as on phones). Both switches already exist: `?perf&no=msaa,screenlights`.

The full unscissored copy now runs only for two frames after the view rects change; otherwise just the stage rect is copied. Every feature can be switched off for an A/B test: `?perf&no=ssao,pcss,contact,screenlights,bloom,reflector,msaa,dof,envcapture`.

**H3, responsive images.** Every proof and poster now has AVIF and WebP at 640, 1200, 1800 and 2400px (never wider than the source; `tools/proof-sizes.mjs`), served with `srcset` and `sizes` per layout slot. Only the first proof is eager and high priority. The page preload uses the same `imagesrcset`, so phones never preload a file they don't use.

**Bytes over the wire on a phone** (390×844 @3x), before any scroll (`tools/transfer-sizes.mjs`). The console is clean on every page.

| Page | Before fixes | **Now** | Now, of which |
|---|---|---|---|
| /work/sook | 1.53 MB | **1.13 MB** | JS 0.59 · images 0.25 · model 0.08 |
| /work/too-yumm | 1.60 MB | **1.19 MB** | images 0.23 · model 0.17 |
| /work/sonde | 1.55 MB | **1.22 MB** | images 0.22 · model 0.20 |
| /work/house-of-hex | 1.62 MB | **1.27 MB** | images 0.25 · model 0.22 |
| /work/indo-thai | 3.69 MB | **1.29 MB** | model 0.27 · images 0.23 |
| /work/bengal-t20 | 1.93 MB | **1.41 MB** | images 0.46 · model 0.16 |
| /work/mitooshi | 4.75 MB | **1.43 MB** | images 0.35 · model 0.29 |
| /work/jsw-sports | 2.04 MB | **1.45 MB** | images 0.57 · model 0.09 |
| /work/shunya | 1.95 MB | **1.46 MB** | model 0.46 · images 0.20 |

**All nine are under 1.5 MB.** Two fixes:
1. **Phone models now use WebP textures** (EXT_texture_webp) instead of KTX2, so a phone never downloads the 0.25 MB Basis transcoder. The mobile GLBs got smaller too: all nine went from 3.58 to 2.22 MB, and SHUNYA's from 0.70 to 0.54 MB. Desktop keeps KTX2.
2. **Proof videos wait until they are near the screen.** Mitooshi's and Indo Thai's started downloading 2–3 MB a full screen ahead, because of an `autoplay` attribute. Now nothing is fetched until a video is a quarter screen away.

What's left per page is fixed: 0.59 MB of JS (the 3D runtime included), 0.16 MB HTML/data and 0.05 MB fonts. The rest is the tray model and the first image.

**H4, model streaming.** Models load two at a time in view priority:
1. the tray object;
2. the home lineup, left to right;
3. the rest when the browser is idle.

Phones get the mobile variants. On a phone, the models a project page doesn't need wait for the visitor's first scroll or touch.

| First load | Models | + Basis | Page total |
|---|---|---|---|
| Desktop `/` | 8.84 MB (9 GLBs, left to right) | 0.25 MB | 10.0 MB |
| Desktop `/work/sonde` | 2.89 MB (the tablet first, then 2 more while idle during the measurement) | 0.25 MB | 4.19 MB |
| Phone `/` | 1.93 MB (9 mobile GLBs) | none | 2.86 MB |
| Phone `/work/sonde` | 0.20 MB (the tray object only; the rest wait for a scroll or touch) | none | 1.22 MB |

**H5.**
- R3F's `THREE.Clock` is replaced with `THREE.Timer` (`tools/patch-r3f-timer.mjs`, run on `postinstall`).
- Phones no longer get the "preloaded but not used" warning.
- Vercel Analytics renders only on Vercel builds, so local and CI builds don't log a 404 for its script.

## 3. Models (A)

| Model | Desktop, source → web | Mobile, source → web |
|---|---|---|
| Mitooshi laptop | 5.48 → 0.88 MB | 1.96 → 0.33 MB |
| House of Hex phone on stand | 3.22 → 0.57 MB | 1.22 → 0.25 MB |
| Sonde tablet | 3.27 → 0.52 MB | 1.29 → 0.23 MB |
| Indo Thai pushback tug | 5.41 → 0.71 MB | 2.43 → 0.32 MB |
| Bengal T20 set | 17.76 → 1.47 MB | 5.22 → 0.17 MB |
| JSW book, with its `open` clip | 1.04 → 1.45 MB | 0.32 → 0.10 MB |

All within ≤ 1.5 MB desktop and ≤ 600 KB mobile. Bengal's textures are 1024/512 and the tug's 1024/512. Desktop textures are KTX2 (UASTC for artwork, ETC1S for data maps); phone textures are WebP (H3). Geometry is meshopt.

**JSW.** The source GLB was a lightly compressed 1 MB JPEG file. Its 2048 textures came out at 2.41 MB as KTX2, so they're capped at 1536 (desktop) / 768 (mobile).

**Totals, all nine models:** 9.6 MB desktop, 2.2 MB mobile. They load in priority order, not all at once.

**What's done:**
- **A2.** The procedural laptop, tablet, phone and Bengal stack are deleted, along with their crop textures and tool.
- **A3.** Each device's `screen` mesh shows the brand logo on its `bg.txt` colour through UV0, at the README aspect. The optimizer had been stripping the screens' UVs (`prune` removes attributes no texture uses), so every screen showed only flat colour. It now keeps them.
- **A4.** Indo Thai is in the lineup (the tug, on the raised middle tier) and clickable.
- **A5.** JSW stands closed in the booth. On arriving on the tray it plays `open` to its last frame over 900ms (eased), and back on leaving. The book opens leftward from its spine, so the tray shot frames the open book: twice the closed width, centred on the open spread. `jsw-open-sheet.png` holds 12 frames. The closed book reads as a closed book from the home camera.
- **A6.** See `model-ref/` in the zip (all ten, plus JSW open). Geometry and textures match the Blender renders, and JSW open matches `ref-open.png`. The reference view now has the same 0.18 grey world as Blender: metals rendered black against a black environment before, which made the site look much darker than the reference.

## 4. The booth (B)

**B1, B2.** The palette card, checker and test strip are gone. A framed **Certificate of Calibration** stands on the shelf:
- black satin frame, glass, matte paper;
- the face reads only "CERTIFICATE OF CALIBRATION", "VM BOOTH 01" and "Vishesh Mahendru", set in the site's own fonts;
- click opens `/about`; hover shows the spec plate "About".

It is a small framed print, so it isn't held to the 11% rule, but it is in the overlap check.

**B3, ten objects.**

| Row | What stands there |
|---|---|
| Front | Too Yumm · Bengal (on its own sloped wedge, cut from the set's tilt) · SOOK · SHUNYA (on the clear riser with a dark N3.5 backing board) · House of Hex |
| Raised middle tier | Mitooshi · the Indo Thai tug · Sonde |
| Back, high | JSW, closed |
| Shelf | The certificate |

`check-sizes` results:

| Width | Smallest sample | Worst projected overlap | Minimum gap |
|---|---|---|---|
| 1440 | 11.8% (Too Yumm) | 0.1% | 8.3cm |
| 1568 | 11.8% | 0.2% | 8.3cm |
| 1920 | 11.8% | 0.0% | 8.3cm |
| 2560 | 11.7% | 0.0% | 8.3cm |
| 1366 | 11.9% | 0.4% | 8.3cm |
| 725 | 12.0% | 1.1% | 8.3cm |
| 390 | 11.8% | (phone: one sample at a time) | |

The largest samples are Mitooshi at 16.8% and Sonde at 15.9%.

**B4, picking.** A sample is pickable only if:
- the ray hits the object itself or its base (never its shadow on the floor);
- every parent is visible;
- at least 60% of its projected box is inside the view;
- nothing solid (wall, cabinet, tray) is nearer.

Only the nearest sample is hit.

**The SHUNYA-on-Mitooshi bug had two causes:**
1. Hidden front-row samples could still be raycast.
2. Some GLB subtrees' world matrices were stale between frames. The tug was effectively a metre from where it renders, so the header's empty corners opened Indo Thai.

Picking now refreshes world matrices first. `check-picking` raycasts a 40×24 grid on every booth route at 1568 and 390.

**B5, brightness.**
- The walls are now N8 (`#C4C4C2`), the plinths N8.5, and the diffuser brighter (0.78 → 0.95 D50).
- The room lamps (D50, TL84, A) now tone-map with Khronos PBR Neutral instead of AgX. AgX's shoulder squeezed a 1.75× albedo difference between paper and wall into 1.13×, so no exposure could put the wall in 76–82 and the paper in 88–94 at the same time. Neutral is linear to 0.76, the standard for product viewing.
- The dark lamps keep AgX.
- Exposure: D50 0.635; TL84 and A scaled by the same factor, so their character relative to D50 is kept.

Readings are with `tools/measure-brightness.mjs`: CIE L\* (median of 9×9 px) on the back wall and on the certificate's white paper, at 1568×980.

| Lamp | Wall before → after | Paper before → after |
|---|---|---|
| D50 | 66.2 → **79.8** (target 76–82) | 75.6 → **90.2** (target 88–94) |
| TL84 | 60.3 → 68.6 | 72.7 → 84.6 |
| A | 56.3 → 67.7 | 39.6 → 47.0 |
| FLOOD | 17.3 → 24.5 | 11.1 → 22.7 |

FLOOD and A light the shelf less by design: a hard spot and a tungsten pool.

## 5. Home (C)

- **C1, C2.** One centred column: headline, subtext, booth, panel. The header stays full width. The stage is min(content width, 1.6 × the height left under the headline and above the panel), so booth and panel fit in one screen. Checked at 390, 725, 1024, 1568, 1920 and 2560×1440 (`check-layout`).
- **C3.** Phones under 600px get their own portrait shot: the cabinet's height fills a 4:5 box, panned so the focused sample sits in the centre, and swipe stays. A tighter crop is impossible because the booth draws into the whole stage, so anything past the box landed on the headline (caught in the first screenshots). **Partial:** the phone uses the same staging as desktop; a separate phone arrangement of the ten objects is not built.
- **C4.** On home the panel sits in the flow, centred under the booth. On project pages it is a centred floating pill showing the active lamp: it opens on hover or click and folds back when the page scrolls content under it. Pages keep room under their last content for it.
- **C5.** On `/` the first nav item reads **Index** and swaps the home view in place, with the URL unchanged. The Index view is a clean list (number, project, discipline, year) with the project's first image beside it on hover; from there the item reads **3D viewport**. On other pages it reads **Home** → `/`. House lights stays separate (rocker / I).

## 6. Project pages (D)

- **D1.** The 3D header is ≥ 62svh on desktop and ≥ 48svh on phones. It starts under the masthead, so the name never sits over the booth frame. The tray object is large, with its neighbours dimmed behind.
- **D2.** Left column: the title block stacked directly on the calibration label. M1 is in the right column, its top on the title block's.
- **D3.** The story order:
  1. M1;
  2. P1 centred at about 62ch;
  3. M2 and M3 side by side;
  4. P2 and P3 side by side, each heading kept with its paragraphs (stacked on phones);
  5. the remaining media in a grid.

  Empty slots are skipped.
- **D4.** "Live site ↗" / "Full case study ↗" is a row inside the calibration label, on Mitooshi, Sonde, House of Hex and Indo Thai only. The old bottom link is gone.
- **D5.** "← Previous project" and "Next on the tray →", full width, wrapping round the lineup.
- **D6.** On phones: full-width proofs, the swatch row under each image, smaller crop marks.

## 7. About (E)

- LOCATION reads "India" plus a live clock: Asia/Kolkata, 24h HH:MM, mono, "IST". It ticks on the minute, is not announced (`aria-live="off"`), and is client-only (the server renders `--:--`), so there's no hydration mismatch.
- "Open to remote roles worldwide", the CHECKED UNDER strip, the PASS stamp and its sound are removed.

## 8. Mitooshi (F)

- Deliverables 04–07 are deleted everywhere: files, import data, palettes, sizes, alt text, masters list, and the raw import snapshot. The importer now skips them if it is ever re-run.
- The two GIFs (moved to `assets-src/mitooshi/`) are the new 04 and 05. Each is a looping, muted, playsinline video in H.264 MP4 plus VP9 WebM, with a poster:
  - 04, the globe: 1.6 MB MP4 / 1.4 MB WebM;
  - 05, the spheres: 2.4 MB MP4 / 1.8 MB WebM;
  - originals 17.7 MB and 16.1 MB GIF.
- Alt text was written from the frames; palettes are from the posters.
- The deliverables rule in `lib/types.ts` (and the strip) is now 4–8.

## 9. Archive (G)

- Titled by the original A-numbers, exactly as given, in caps. The displayed numbers run A01–A49 with no gaps: 45 stills plus 4 clips (A29 was the removed duplicate).
- The AMG GTR clips are 960px square loops, H.264 plus VP9, with posters at 480 and 960. The four together are 4.1 MB MP4; the Wireframe source alone was 43 MB. They sit right after the last AMG still (A18–A21), titled "MERCEDES-BENZ AMG GTR - 3D EXPLORATION". They play muted and loop only while on screen; under reduced motion they show the poster. Sources are in `assets-src/archive/amg-gtr/`.
- One row of chips (All · Music cover art · 3D explorations · Posters · Other), kept in `?series=`.

## 10. Turntable (I)

- **Drag:** turns a GLB about its vertical axis only. Under 6px is a click.
- **Release:** inertia, damping out over about a second; none under reduced motion, and none if the pointer paused before letting go.
- **The tray object** turns too.
- **Keyboard:** ← → turn the focused sample 15° (↑ ↓ now move between samples). On a project page, the focused header turns the tray object.
- **Phones:** turn only the object on the project tray.
- **What it never touches:** the lamp, the camera (its pointer parallax holds still during a drag) or the layout.
- **Duration:** a turn lasts until the route changes.
- **Contact shadow:** re-bakes when a turn comes to rest.
- JSW's open/close is still the only animation.

## 11. Realism (J)

- **J1.** `tools/booth-room.glb` is exported with UV1: the room only (interior, frame, housing, hood, diffuser, lip; 13 parts). `tools/camera.json` is re-exported for the batch-07 staging. Plinths, riser and shelf keep their own AO in code (`public/booth/ao.png`, re-baked for the new bases). The site picks up `public/booth/lightmap.ktx2` (or `.png`) automatically when it exists.
- **J2.** The first time each lamp is on screen, the live booth (walls, diffuser, plinths and samples, with the rig at that lamp's full output) is captured into a cube from the middle of the booth on the GPU and prefiltered. It is cached per lamp and used as the environment for glossy materials. The capture happens before that frame is drawn, so there's no step in brightness afterwards. Desktop only.
- **J3.** Subtle imperfections:
  - fingerprints and hairline scratches in the gloss of the acrylic riser, the certificate glass and the device screens;
  - slow wiped roughness variation on the walls;
  - a paper fibre normal on the certificate;
  - 3mm rounded plinth bevels that catch the light.
- **J4.** A subtle desktop depth of field: focus on the tray object, else on the hovered or keyboard-focused sample; a 12-tap disc a few px wide; none otherwise, on mobile, or under reduced motion. A gentle vignette inside the stage only (corners about 10% down). No chromatic aberration.
- **J5.** On a session's first visit the booth comes up dark, then the D50 tubes strike: two flickers, then full, 1.2s, with the switch sound if sound is on. It is skipped on repeat visits, under reduced motion, in house lights, and if the visitor already has another lamp. It starts after the booth is ready, behind the poster, so first paint and the LCP image never wait for it.

## 12. Budgets (K7)

| Budget | Limit | Now |
|---|---|---|
| JS before 3D (gz) | ≤ 200 KB | **180.1 KB** |
| 3D JS, lazy (gz) | ≤ 480 KB | **422.8 KB** |
| Models per tier (the new six) | ≤ 1.5 MB desktop / ≤ 600 KB mobile each | all within (largest: Bengal 1.47 / 0.44 MB) |
| All nine models | | 9.6 MB desktop, streamed in priority |
| Phone project page before scroll | ≤ 1.5 MB | **met**: 1.13–1.46 MB on all nine (§2) |
| Models, mobile, all nine | | 2.22 MB (WebP textures) |

## 13. Notes and deviations

- **Phone models switched to WebP after the picking run.** The geometry is unchanged, so the picking results stand.
- **Phone composition (C3).** See §5: the phone has its own portrait shot, but not its own arrangement of the objects.
- **Tone mapping.** D50, TL84 and A now use PBR Neutral (see B5). The dark lamps keep AgX. SCREEN's exposure is trimmed (0.6 → 0.45) because the brighter N8 walls bounce more of the screens' light.
- **Frame budget.** Software rendering can't show the 8ms / 16ms GPU budget; the table gives each pass's relative cost. Read real numbers on the RTX with `?perf` and `__boothPasses(30)`.
- **The certificate** is a small framed print on the shelf, not held to the 11% sample rule (it is in the overlap rule).
- **AMG clip alt text** and the Mitooshi loop alt text were written from frames I looked at. Change any by exception.
- **Commits.** Pushed after H, A/B, F, then B through I together, then J and K. Pushed regularly, but not one push per lettered section.
