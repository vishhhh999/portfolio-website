# Delivery report: the A to I batch

This covers the batch on branch `claude/session-access-question-dqidr4`, merged into `main` through PR #1.

## Status by section

| Section | Status |
|---|---|
| A. Lamp behaviour | Done. The lamp never switches by itself. Your choice is kept for the visit (`vm:lamp:v1`). There is a chip to go back to the native lamp. `tools/check-lamp.mjs` passes. |
| B. Image fidelity | Done. Under D50, proofs are the plain image files: no grain, no 3D plane. The other lamps add blue-noise dither. Masters pipeline (`tools/import-masters.mjs`): 43 of 45 matched, AVIF + WebP. The full report is `tools/masters-report.md`. |
| C. Glitches | C1 to C8 fixed and tested (see the list below). C9 GIFs were dropped at your request. |
| D. Realistic 3D | Done. GLB pipeline, AgX tone mapping, a light environment per lamp, soft and contact shadows, SSAO on desktop, baked AO, a 35mm lens, booth construction, staging, lamp warm-ups, and the `booth-shell.glb` / lightmap path. |
| E. Content | Done. The About page uses the live site's facts. Discipline tags, client types and links are in. Copy and alt text are corrected. Old `/projects/*` addresses 301-redirect to `/work/*` (9 of 9 pass). |
| F. Archive | Done. One duplicate removed (A29). Filtering is by series; there is no year filter. Phone-sized images were added in this pass (see Lighthouse). |
| G. Logos | Done. Brand logos show on the booth screens. |
| H. Sound | Done. All procedural, so there are no audio files. 13 of 13 checks pass. |
| I. Extras | Done. Booth-to-project transition, spectro loupe (press L or hold Alt), 404 page, resilience, shortcuts (press ?), Vercel Analytics, and loading. |

## Glitch list (C)

| # | Glitch | Fix | Verified |
|---|---|---|---|
| C1 | Booth misaligned with the page | Camera spans the whole canvas and the stage is cut out of it; re-measured on resize and when fonts load | `tools/check-views.mjs` at 1280, 1568, 1920 and 2560 wide, with resizes and scrollbars: worst case 1.9px |
| C2 | Jagged edges | MSAA with an SMAA fallback | Screenshots |
| C3 | Flickering where surfaces overlap | Surfaces moved apart and polygon offset added | Screenshots |
| C4 | Maker's plate overlap | Plate repositioned | Screenshots |
| C5 | Stale shadows after a lamp change | Shadow cache cleared on lamp change and when assets load | Screenshots |
| C6 | Proof plane lagging behind scroll | One shared animation clock | Scroll drift test: 0px |
| C7 | No performance readout | Add `?perf` to the address | Manual check |
| C8 | Sharpness "pop" when quality steps down | Step happens when idle; resize and redraw in the same frame | Manual check |

These were only checked in software rendering (this environment has no GPU), not on a real graphics card: C2 anti-aliasing quality, the soft-shadow softness, SSAO, and the C8 quality step.

## Budgets

| Budget | Target | Actual |
|---|---|---|
| JS before the 3D loads (gzip) | ≤ 200 KB | 176 KB |
| 3D JS, loaded later (gzip) | ≤ 460 KB | 419 KB |
| Models, desktop | ≤ 6 MB | 5.83 MB |
| Models, mobile | ≤ 2.5 MB | 2.0 MB |
| iPhone 15 frame rate | ≥ 50 fps | **Not measured: needs a real phone.** Open the site with `?perf` to see it. |

## Lighthouse (local production build)

| Page | Device | Perf | Accessibility | Best practices | SEO | LCP |
|---|---|---|---|---|---|---|
| /about | desktop | 100 | 96 | 96 | 100 | 0.7 s |
| /about | mobile | 94 | 96 | 96 | 100 | 2.9 s |
| /house-lights | desktop | 100 | 96 | 96 | 100 | 0.6 s |
| /house-lights | mobile | 95 | 100 | 93 | 100 | 2.8 s |
| /archive | desktop | 99 | 100 | 96 | 100 | 1.0 s |
| /archive | mobile | 83 (was 67) | 100 | 93 | 100 | 4.1 s (was 18.9 s; page weight 5.2 MB down to 0.69 MB) |
| / (booth) | desktop | not representative | 100 | 96 | 100 | 0.9 s |

The 3D pages (the booth and project pages) cannot be scored fairly here. With no GPU, the 3D is drawn by the CPU, which shows up as tens of seconds of "blocking time" that a real device does not have. The fair test is PageSpeed Insights on the live URL after deploy.

Best practices loses points for the console error from the Vercel analytics script. That script exists only once the site is deployed on Vercel.

## Assets still to come from you

- **Masters:** Mitooshi 04 and 06 have no full-colour master, so they still use the web images.
- **Models:** too-yumm, sook, jsw-sports and shunya use your GLBs. The other four samples are built in code.
- **booth-shell.glb / lightmap:** `tools/booth-shell.glb` and `tools/camera.json` are exported for Blender. Bake a lightmap from them and drop it in `public/booth/`, and the booth uses it automatically. Until then it uses the baked AO.

## Sound list

- **Beds:** one quiet procedural bed per lamp (D50, TL84, A, UV, FLOOD, SCREEN, AFTER DARK).
- **Events:** one lamp switch sound per lamp, breaker on/off (house lights), hover, select, swipe, route change, stamp, paper feed, loupe, loupe beep, toggle.
- Sound is off until the visitor turns it on, and the choice is remembered.

## Tests (all passing)

- Lamp: `tools/check-lamp.mjs`
- View alignment: `tools/check-views.mjs`
- Sample sizes: `tools/check-sizes.mjs`
- No sideways scrolling at 390px wide, 13 routes: `tools/check-overflow.mjs`
- Redirects: `tools/check-redirects.mjs`
- Sound: `tools/check-sound.mjs`
- Typecheck and production build
