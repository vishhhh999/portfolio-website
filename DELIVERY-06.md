# Delivery report: batch 06

This report covers glitches, layout, proofs left untouched, house lights as a mode, the About page, composition, SCREEN and the lightmap.

The work is on branch `claude/session-access-question-dqidr4`, PR #2. Screenshots are in `booth-06.zip`, and every tool named here is in `tools/`.

All browser checks ran in software rendering (SwiftShader, no GPU). Anything that depends on real GPU timing is marked as such.

## 1. Tests (L1)

| Check | What it proves | Before (`e3d6ada`) | Now |
|---|---|---|---|
| `check-smear` (A1, A1b) | No booth pixels outside the current views, at rest, while scrolling 0/300/700/1200/0, when opening a project from the booth, and walking / → too-yumm → sonde → /. Also checks each route registers only its own views. | **FAIL** at 1568 (stale booth over the title and around the Sonde proofs) | PASS at 1568 and 2560 |
| `check-flicker` (A2) | No presented booth frame drops more than 5% below its neighbours while the pointer moves across the page | n/a (needs the new capture hook) | PASS: D50 worst drop 0.1%, A 0.2%, 62 frames each |
| `check-houselights` (B5) | I and the rocker toggle in place, URL and content unchanged; a stored choice loads flat; no panel on /about and /archive; no UI link to /house-lights | would fail (the toggle navigated) | PASS, 18 of 18 |
| `check-layout` (D1, D5) | Cabinet centred in the stage to ±2px at 390 to 2560; stage gutter to gutter; nav, footer and the next-project row end on the right gutter to ±2px at 1568 and 2560 | | PASS, all (centring error 0.0px) |
| `check-sizes` (F1, F7) | Every sample ≥ 12% of the cabinet; projected boxes overlap ≤ 3%; 3D gaps ≥ 6cm | | PASS: overlap 0.0%, minimum gap 6.3cm, smallest sample 12.0% (Too Yumm at 2560) |
| `torch-closeups` (C2) | Under the torch's core the pixels equal the file; the falloff is monotonic; outside the torch the image really goes dark | | PASS: maximum channel difference 0 on Sonde 03, Too Yumm 01, JSW 02; no rings; 0% of the file outside |
| `check-lamp` | The lamp never switches by itself | PASS | PASS, 14 of 14 |
| `check-sound` | | PASS | PASS, 13 of 13 |
| `check-views` | Alignment | PASS | PASS (worst edge 0.3px) |
| `check-overflow` | No horizontal scroll at 390px | PASS | PASS, 13 routes |
| `check-redirects` | Old Framer project URLs redirect | PASS | PASS, 9 of 9 |
| Typecheck, production build | | | PASS |

## 2. A1 to A4: the glitches

**A1 and A1b: one root cause.**
- The booth renders into a multisampled buffer.
- three.js copies that buffer to its readable texture only at the end of a render, and only inside the scissor that is active then (the booth's stage rectangle). A frame with nothing on screen only cleared and never copied.
- So everywhere outside the current stage the texture kept old frames:
  - the venetian trails as the header scrolled;
  - the whole home cabinet under the project page after opening a project;
  - the Sonde proofs a second time, about 330px down.
- **Fix:** every frame now finishes with a full, unscissored copy, and starts from a full transparent clear. A tab that loads hidden re-measures and redraws when it becomes visible.

**A2, the black flicker.** Not reproduced in software rendering on either build. The new build records no dark frame under D50 or A while the pointer moves.

What would rule a real-GPU cause out:
- The A1 fix means no frame can show partly stale content.
- Each frame starts from a full clear.
- Motion code now guards against bad time steps.

**This still needs one look on the RTX machine.**

**A3, project-to-project switching.**
- The old path sent the click through a view transition. That keeps the old page frozen as a snapshot until the new route has finished rendering, so there was no animation and the page appeared to hang.
- Now the sample is set on the tray in the click handler, so the old sample returns to its base and the new one slides onto the tray at once.
- Hovering or focusing a sample prefetches its route and first image.
- Every shader is compiled once at boot.

| Path | Before | Now |
|---|---|---|
| "Next on the tray", click to first animated booth frame | no booth frame within 2s of the click | 220ms here, which is about one software-rendered frame (a GPU frame is about 16ms) |
| Long tasks over 50ms during the transition | none | none |

**Also fixed (found while testing A3):** on a project page the other samples sit under the masthead, which swallowed clicks on them. Now only the masthead's actual links and buttons block the booth.

| Path | Now |
|---|---|
| Header click on Mitooshi | navigates in 116ms; no long tasks |

**A4.** `transition-sheet.png` (12 frames, 33 to 767ms after the click): the camera dollies from the cabinet into the tray in clean steps, and the page fades in underneath. No empty or broken frames.

## 3. SCREEN luminance (L6)

Readings are the median CIE L* over the centre of each object, on the presented frame (`tools/measure-screen.mjs`).

| Object | Before | After |
|---|---|---|
| Too Yumm pouch | 0.1 | 15.6 |
| JSW book | 0.4 | 23.9 |
| SOOK boxes | 0.2 | 19.4 |

All three are inside the 15 to 25 target. How it's lit:
- The only light is each screen's own area light (desktop) or the combined screen light (mobile).
- Their bounce off the booth's interior lights the fronts, since the screens face away from every object.
- Nothing glows without a screen to cause it: no fill and no environment glow.

## 4. SHUNYA model reference (L7)

`model-ref/shunya.png`: the four pieces render as in Blender, and the Pooja carton's dot grid and the labels map exactly as in the reference. The site render is a little darker overall.

In the booth the pieces are re-arranged in one row: carton, Ritual Set, jar, with the Air tin low in front. The lid, jar and tin each show, and the group is 17 to 18% of the cabinet width.

## 5. Lightmap (J)

No lightmap is in `public/booth/` yet, so J1 to J4 are skipped. J5 is done: `tools/booth-shell.glb`, `tools/camera.json` and the AO are re-exported from the final batch-06 geometry (same second UV set).

To bake, add these to `public/booth/`:
- `lightmap.exr` (linear half float) and/or `lightmap.png` (16-bit linear)
- `lightmap.README.txt`

The site's lookup now also checks `public/booth/lightmap.ktx2` (the converted file).

## 6. Budgets (L8)

| Budget | Limit | Now |
|---|---|---|
| JS before 3D (gz) | ≤ 200 KB | 177.6 KB |
| 3D JS, lazy (gz) | ≤ 460 KB | 404.8 KB |
| Models, desktop / mobile | ≤ 6 / 2.5 MB | 5.83 / 2.0 MB (unchanged) |

## 7. Notes and deviations

- **Commits.** Commits are per section (A; B; C; D and E; F to I with J5; K), but they went up in one push, not one push per section. The sections were worked on side by side.
- **Palettes (C4).** Some images have fewer than 6 distinct colours, and they show only what is there:
  - Mitooshi 04 and 06 and the Mitooshi posters: 3 each
  - Sonde 03: 3
  - SHUNYA 05, Sonde 02: 4
- **Booth size.** From 1024px up, the stage is height-limited (78svh and the room above the lamp bar), so the cabinet is centred in a full-width stage rather than touching the gutters. At 725px it reaches the gutters exactly.
- **Torch (C2).** The first implementation redrew each image in WebGL as a masked plane. Its core came out softer than the file, because GPU texture filtering scales an image down differently from the browser. The test caught this once it forced the torch on (it now also checks that the torch is actually there).
  - **Final approach:** the image is never redrawn. The page's own `<img>` stays visible, and a thin 2D overlay above it darkens everything outside the torch: a smootherstep falloff over 24 gradient stops, dithered by the browser.
  - **Result:** the core is the file's own pixels, so the multiplier is exactly 1.0. The WebGL proof planes are removed.
  - **Where it works:** on every GPU tier, including the low tier, which used to show plain images under AFTER DARK.
- **Docs.** PROJECT-CONTEXT.md is now in the repo and updated:
  - §1 and §2: proofs are never relit, and house lights is a mode;
  - §4 and §6: the panel and layout;
  - §5: the live years, stated exactly;
  - §7, §9 and §11: tools, tests and open items.
