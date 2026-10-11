# Delivery report: batch 09A (integration, fixes, experience pass)

PR: https://github.com/vishhhh999/portfolio-website/pull/7 · branch `claude/quirky-knuth-70j1df` · preview: https://portfolio-website-git-claude-quir-6d3869-vishafterdark-projects.vercel.app (Vercel login).
09B (the responsive shelf system) is not in here.

**Everything below was verified in software rendering (SwiftShader, no GPU).** Pixel checks, sizes and layout are exact; anything measured in milliseconds is only a ratio. The real frame time needs your RTX (section 9).

## 1. Checks

| Check | Result |
|---|---|
| `poster-hash --check` (build gate; now hashes the served lightmap and the 18 tray posters) | PASS |
| `check-poster` (home, first visit, and every tray poster, desktop + phone) | PASS 22/22 (worst 1.95%, limit 2.5%). Too Yumm desktop tray was 3.39% on the first run (captured before its neighbours settled); re-rendered on the settled shelf, now 0.37% |
| `check-flicker` (reveal, hover D50/A, lamp change, **new: D50 → SCREEN → D50**, spin, JSW open) | PASS, every scenario: no frame dips (worst 1.0%, limit 5%); poster vs live 1.62%. SCREEN switch 64ms key-to-frame in software; the idle SCREEN shader pre-warm had not run yet when the test switched, so on a real GPU the switch can only be cheaper |
| `check-coplanar` (new, B1) | PASS: 0 separate parts within 0.5mm where a camera sees them. The 08 House of Hex fails it (screen 0.005mm off its glass, 11,337mm²) |
| `check-sizes` (+ new SHUNYA mesh clearance, H3) | PASS at all 8 sizes. Phone 10.6% (was 9.4%), worst overlap 1.1% at 1568, min gap 8.9cm. SHUNYA pieces ≥ 11.3mm apart (the Pooja carton was intersecting the Ritual Set) |
| `check-picking` | PASS 30/30 |
| `check-targets` (new, P1) | PASS on 7 routes × desktop / phone / tablet |
| `check-axe` (new, P8) | PASS: 0 serious or critical on 14 routes × 1568 / 390 |
| `check-pill` (new, F3 + P4) | PASS: pill clear of every proof, label, link and end card on 9 pages × 1568 / 390; masthead clean at 6 widths. The first run failed because software rendering delivers scroll events seconds late; the check now measures once the event has arrived |
| `check-about` (new, J) | PASS at 390, 768, 1024, 1440, 1920, 2560 |
| `check-07` (+ M5: every mailto equals the helper) | PASS 27/27 |
| `check-houselights`, `check-lamp`, `check-layout`, `check-views`, `check-smear`, `check-overflow`, `check-redirects`, `check-sound`, `check-switch` | PASS, all 9 (`check-lamp` and `check-layout` updated for the new end cards) |
| Typecheck, production build | PASS |

## 2. Models (A) and lightmap sizes

| Model | Desktop 08 → 09A (MB) | Phone 08 → 09A (MB) |
|---|---|---|
| Too Yumm | 1.00 → 0.51 | 0.19 → 0.18 |
| JSW Sports | 0.64 → 0.78 | 0.10 → 0.11 |
| Mitooshi | 0.95 → 0.72 | 0.33 → 0.25 |
| Sonde | 0.61 → 0.12 | 0.23 → 0.06 |
| House of Hex | 0.74 → 0.54 | 0.25 → 0.25 |
| Bengal T20 League | 1.47 → 0.51 | 0.17 → 0.17 |
| SOOK | 0.56 → 0.32 | 0.09 → 0.10 |
| SHUNYA | 2.09 → 1.18 | 0.54 → 0.42 |
| Indo Thai | 0.71 → 0.59 | 0.32 → 0.32 |
| **Total** | **8.77 → 5.27** (budget 7) | **2.22 → 1.86** (budget 2.5) |

How: desktop artwork is now WebP (3 to 5 times smaller than UASTC at the same look, as proven on JSW in 08); ORM and normal maps stay KTX2. SHUNYA: artwork 1536, normal 1024, ORM 512 on desktop; 768 / 256 on phones; meshes decimated (41k → 17k triangles desktop, 11k → 6.7k phone).

What the pipeline fixed in the delivered files (positions only, no Blender work):
- **Mitooshi's screen faced into its lid**, so the logo was culled (black screen). It is turned to face the front.
- Parts that sat within 0.5mm of another part are moved 0.3 to 0.5mm apart: the Mitooshi logo and bezel, the Bengal jersey and ticket over the flag, the Sonde easel, the House of Hex phone in its stand.
- Extra empty Blender scenes dropped.

**Flag: the Too Yumm front art is only about 610px wide** (its README). Not upscaled. A larger front file would sharpen the pouch on the tray.

Staging: Mitooshi now uses its real GLB bounds (312.6 × 212.3 × 301.1 mm) and is centred on its footprint (its open lid reaches back). JSW: the tray shot frames the open book's measured 3D box (frame 30), so it is centred and whole at every width, including the 2560 lower-corner case.

Overlaps inside one part (same mesh) that a camera can see are listed by `check-coplanar` for the Blender session: SOOK sleeve vs tray panels (coincident), the Mitooshi keyboard, the SHUNYA air tin and jar label, Indo Thai tug and wheels, the Bengal ticket. They are one surface over another in the same material, not a screen over glass.

**Lightmap served per tier:** desktop `lightmap.ktx2` 818KB (2048, UASTC with sRGB transfer). Phones `lightmap-phone.webp` 11KB (1024). No device downloads the 16-bit PNG or the EXR any more (both moved to `assets-src/booth/`). Decision: UASTC HDR was 1.76MB for no gain, because the bake peaks at 0.925, so it fits an 8-bit sRGB-encoded texture, which keeps its precision in the darks. Phones get the lightmap too: at 11KB it costs nothing and matches desktop.

## 3. Lightmap, normals, corners, first-visit frame

- **C0 cause:** the lightmap's per-lamp tint was never applied. The shader patch targeted a line that is still an `#include` when the patch runs, so it silently did nothing. The lightmap shone at full white under every lamp, including the dark first frame (the 5.5% poster mismatch) and SCREEN (part of why SCREEN looked uniformly lavender). **Fix:** the chunk is expanded and patched. The tint follows the opening strike like every other light, so the dark first frame has no lightmap until the tubes strike. A shape check throws if three changes the chunk.
- **C2/C3:** the bake is tinted and levelled per lamp from `lampPresets` (new `bake` field). On room surfaces it **replaces** the realtime ceiling panel and the hemisphere bounce (the bake already contains both); objects keep every realtime light. SSAO stays objects-only; contact shadows and plinth AO stay.
- **Loupe (wall / paper L\*):**

| Lamp | Before (08 + raw lightmap on main) | After |
|---|---|---|
| D50 | 85.3 / 88.8 | **79.2 / 90.0** (targets 76–82 / 88–94) |
| TL84 | 74.8 / 81.5 | 69.2 / 82.5 |
| A | 61.0 / 62.8 | 60.3 / 66.0 |
| FLOOD | 43.1 / 26.5 | 26.4 / 26.4 |

- **C4:** the `interior` mesh now faces into the booth. Positions, UV0 and UV1 are byte-identical to aa0e153 in all 13 parts (checked); the winding turns through a new index buffer. The AO bakes came out bit-identical. `tools/booth-room.lock` carries the new hash and a note.
- **C5:** both corner artefacts were on the site: the hood's square ends stopped short of the coved top corners (a slanted sliver of wall at top left, the end face as a dark diagonal at top right). Fixed by drawing the hood 2.2% wider so its ends sit inside the walls. The room file and UV1 are untouched.
- **B2:** near plane 0.05 → 0.15m, far 12m. One 24-bit depth step at the device screens from the home camera (about 3m away) is 0.004mm (was 0.012mm), against the 1mm screen-to-glass gap. No logarithmic depth needed. The old House of Hex gap (0.01–0.08mm, plus 0.01mm of position quantisation) was within a few depth steps: that was the flicker.

## 4. SCREEN (E)

One area light per screen (laptop blue, tablet indigo, phone orange), in the scene only under SCREEN; under every other lamp they are out of the scene. The SCREEN shader variant is compiled while idle (right after SCREEN's environment capture), so the first switch does not stall. Readings: pouch **24.4**, book **23.3**, SOOK **21.3** L* (target 15–25; 08 was 19.3 / 22.4 / 20.8). Phones keep the one combined light.

## 5. Screenshots

In `booth-09A.zip`: 1568 and 390 for `/`, `/about`, `/archive`, Mitooshi, Sonde, House of Hex, JSW (held open), SOOK; lamp before/after at 1568 (D50, A, FLOOD, SCREEN); the model-reference sheets; the type contact sheet; three share cards.

## 6. Type test and share cards

- `?type=a` Antonio Bold (condensed grotesk), `?type=b` Instrument Serif (contemporary serif), `?type=c` Archivo Expanded Bold (wide grotesk). All OFL, self-hosted, subset (6 to 14KB), loaded only when their `?type` is on. Default stays Geist. Sheet: `type-sheet.png`.
- Share cards: `public/og/<slug>.jpg` from each tray shot under D50 with the project name in Geist; `/og/site.jpg` from the cabinet. On a preview, the OG URLs resolve on that preview (`VERCEL_BRANCH_URL`); in production on www.visheshmahendru.com. Example tags: `og:image` = `https://<preview>/og/sonde.jpg`, `https://www.visheshmahendru.com/og/sonde.jpg` after launch.

## 7. P items

| Item | Reproduced | Status |
|---|---|---|
| P1 readability and targets | Yes (16px-tall nav, 9.5px labels) | Done: fluid chrome type (11px at 1200 → 14px at 2560), 44px touch targets, ≥ 12px on phones, `check-targets` |
| P2 tray placeholder | Yes (flat #A5A5A3 block) | Done: per-project tray posters, crossfaded by the reveal gate, hashed and checked. A deep link into a project now skips the opening strike (it was dark-then-strike over a lit poster) |
| P3 house-lights label | Yes ("OFF House lights I") | Done: "House lights · BOOTH / FLAT · I", named "Switch this page to its flat, no-3D version" |
| P4 contact + CV in masthead | Yes | Done: CV link, filled "Book a viewing"; phones get a second nav row with 44px targets; `check-pill` checks the masthead at 390–2560 |
| P5 wayfinding | Yes (nothing said) | Done: once per session, home, after the reveal and strike; fades on first input or after 7s |
| P6 sticky title block | Yes (blank beside the proofs) | Done from 1100px, releases at the end of the opening section. Lenis jitter: not observable in software rendering; check it on the RTX |
| P7 case-study ending | Yes | Done: live button again, two cover cards, then the footer CTA |
| P8 a11y + SEO | Partly: the "Keyboard" h2 was the closed shortcuts dialog's heading | Done: axe clean; dialog named "Keyboard shortcuts"; skip link; focus rings; lamp changes announced. Already existed: sitemap, robots, canonicals, meta descriptions, Person and CreativeWork JSON-LD |
| P9 motion polish | n/a | Done: opacity reveals (250ms, ≤ 120ms stagger), crop marks and palette bars draw in, pill label crossfade; all off under reduced motion |
| P10 sample tags (stretch) | n/a | Done: "01 TOO YUMM" tags under each sample, room lamps only, dropped on overlap |
| P11 archive (stretch) | Yes (blank tiles) | Done: dominant colour + blur-up; viewer with arrows, swipe, Esc, `#A07` |
| P12 home stage (stretch) | Yes (small booth in cream at 1920/2560) | Partly: headline and subtext now scale with the stage on large screens; the stage already grows with the height. Needs your eye at 2560 |

The stretch items are DOM and CSS only: they add no GPU work, so they cannot move the frame budget.

## 8. Launch

`LAUNCH.md`: Vercel domain setup and records, a week of Framer fallback, how to verify redirects, canonicals, sitemap and OG, Analytics, rollback. No preview URL is hard-coded in the code.

## 9. Budgets and the RTX commands

| Budget | Target | 09A |
|---|---|---|
| Models desktop / phone | ≤ 7 / 2.5MB | 5.27 / 1.86MB |
| Lightmap | | 818KB desktop / 11KB phone (was a 4MB PNG for everyone) |
| JS before 3D / lazy 3D | ≤ 200 / 460–480KB gz | 183.7 / 433.9KB. First readable paint 60ms (512ms on 4x CPU + fast 4G) |
| Frame p50 / p95 at 1440p | ≤ 8 / 11ms | Not measurable here |

On the RTX 4070 SUPER (Chrome, 2560×1440), on the preview:
1. Open `/?perf`. Console: `__boothPasses(30)` (still) and `__boothPasses(30, true)` (moving). Targets p50 ≤ 8ms, p95 ≤ 11ms.
2. Press 6 (SCREEN) and repeat both: the per-screen lights only cost under SCREEN.
3. Turn a sample by dragging and keep `?perf` open: the moving p95 must stay ≤ 11ms while the contact shadow follows the turn (D).
4. If over budget: `?perf&no=screenlights` (one combined SCREEN light), then `no=msaa4`.

## 10. Not done, and why

- **Blender items** (listed by `check-coplanar`): overlaps inside one mesh, and the Too Yumm front art resolution.
- **Frame timings and the sticky-title smoothness** need your GPU.
- **Portrait (J):** it serves `public/about/portrait.avif` (WebP fallback), made from `masters-v1/about-portrait/portrait.png`. Both files are greyscale (no chroma at all), so the master itself is black and white; it is not a colour master. The caption still reads "Specimen · photographed in daylight". Not changed: your call.
- The lamp panel has no contact link (there was none to make identical); every other contact link uses the helper.
