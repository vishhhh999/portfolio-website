# Delivery report: batch 08

Covers the frame budget, no flicker, masked hover focus, true scale and staging, project headers, phone staging and polish.

Work is on branch `claude/session-access-question-dqidr4`. The screenshots are in `booth-08.zip` (and `tools/lamp-review/08/`). All browser checks ran in software rendering (SwiftShader, no GPU), so GPU milliseconds must be read on the RTX with the commands in §2.

**ROOM FROZEN at `aa0e153`.** `tools/booth-room.glb` (13 parts, UV1) and its sha256 lock (`tools/booth-room.lock`) have not changed since. `bake-booth` refuses to rewrite it unless `ROOM_UNFREEZE=1`. Every later change (true-scale plinths, the shelf, the phone arrangement) left the room's UV1 untouched: the movable parts pack after the room and step their own texel density down when they need room.

## 1. Tests

@@TESTS@@

## 2. Frame budget (B)

**What changed.**
- **Re-render only on change.** The floor reflection, the shadow map and the SSAO normals now re-render only when something changes them: the camera, the lamp, an object's transform, the view rect, the DPR or a model load. Each system has its own dirty flag (`lib/dirty.ts`), shown in the `?perf` overlay with a re-render count.
- **VSM shadows.** Softness is baked into the map once per change; PCSS no longer runs per pixel per frame.
- **One combined screen light on desktop**, as on phones.
- **SSAO normals:** skipped on unchanged frames. Once a lightmap exists, they cover the objects only.
- **No per-frame work** that doesn't change the image. When nothing moves, the canvas doesn't render at all.

**SCREEN** (the reason to combine the lights is that it must still read 15–25 L* on the pouch, book and SOOK):

| | Pouch | Book | SOOK |
|---|---|---|---|
| Before: three per-screen lights | 35.4 | 30.5 | 37.1 |
| Combined light, final gains, 07 staging | 18.3 | 22.4 | 22.9 |
| **Combined light, 08 true-scale staging** | **19.3** | **22.4** | **20.8** |

**MSAA vs SMAA.** I kept MSAA 4x: SMAA breaks the thin highlights on the frame chamfers into dashes, and they crawl under the pointer parallax. Mean change between two parallax frames: MSAA 0.50 / 1.05, SMAA 0.67 / 1.09. Crops: `tools/lamp-review/08/aa-compare.png`.

**`__boothPasses` table (SwiftShader).** These are CPU milliseconds, so the shares matter, not the absolute numbers. "Still" is a frame where nothing changed; "moving" forces every system to re-render.

| Pass (2560×1440, all on) | Still | Moving |
|---|---|---|
| ViewsPass (drawing the booth) | 7019 | 8987 |
| Scene prep (reflector, contact shadows, shadow map) | 350 | 896 |
| NormalPass (SSAO normals) | **1.4** | 54.8 |
| EffectPass | 503 | 497 |
| ShaderPass | 339 | 375 |
| CoveragePass | 50 | 63 |
| **Frame p50 / p95** | **8263 / 8724** | **10872 / 11155** |

The still frame is 24% cheaper than the moving one. On a still frame the normal pass drops 97% and scene prep drops 61%: that is the saving the RTX gets on every frame where nothing moves. The full table, with each feature switched off, is in `tools/lamp-review/08/frame-budget-swiftshader.md`. The phone tier at 390×844 @2x is 1848ms p50.

**Commands for the RTX 4070 SUPER** (Chrome, 2560×1440):

1. Open `https://<preview>/?perf`. The overlay shows the frame time and, on the last line, the dirty flags (● = re-rendering this frame) with counts.
2. In the console, run `__boothPasses(30)`: the still frame (no re-render). Target p50 ≤ 8ms, p95 ≤ 11ms.
3. Run `__boothPasses(30, true)`: every system forced to re-render. This is the worst case while the pointer moves.
4. A/B any feature with `?perf&no=<list>`. For example `?perf&no=msaa4` (MSAA 2x), `?perf&no=reflector,ssao`. Then run `__boothPasses(30)` again.
   - Switches: `ssao`, `vsm` (back to PCF + PCSS), `pcss`, `screencombine` (back to per-screen lights), `screenlights`, `reflector`, `msaa4`, `msaa` (SMAA), `focus`, `contact`, `envcapture`, `bloom`.
5. `?perf&events` adds an on-screen log of every reveal step, lamp change, re-render and contact-shadow re-bake.

## 3. No flicker (C)

- **The poster is the live booth.** `tools/make-posters.mjs` renders it from the current staging: the cabinet frame crop at 1200 and 2400, plus a 4:5 phone poster.
  - The build refuses a stale poster (`tools/poster-hash.mjs --check` hashes every input of the booth image).
  - `check-poster` compares the poster with the live render: 1.34% mean difference on desktop, 0.52% on the phone (limit 2.5%).
  - 07's poster was a different staging. It fails both this check and the reveal check in `check-flicker`.
- **Reveal.** The poster stays until the visible models are in, the lamp's interior is captured and one full frame has rendered (programs compiled first). It then crossfades over 300ms; a model that arrives later fades in over 250ms. Contact sheet: `reveal-sheet.jpg`.
- **No runtime pass changes.** Every pass exists from the first frame. Lights that switch on, like the hover key and the certificate spot, stay in the scene at intensity 0, so no material recompiles mid-session.
- **Pre-capture.** Every lamp's environment is captured while idle, after the reveal, so the first switch to a lamp no longer captures on screen.
- **Contact shadows.** A re-bake after a turntable spin crossfades over 200ms.
- **`?perf&events`:** the on-screen event log.
- **`check-flicker`** now covers the reveal (the poster must match the live render), hover on and off across every sample under D50 and A, a lamp change, a turntable spin with release, and the JSW open.

## 4. Masked hover focus (D)

- Depth of field is gone. A half-resolution mask of the hovered sample keeps it sharp. Everything outside it gets a ≤ 2.5px blur at 1440p, with a ~6px feather.
- Strength ramps in over 250ms and out over 300ms, and crossfades between samples. The tray object rests at 0.6.
- A soft key, about +12%, lights the hovered sample in the lamp's own colour (room lamps only).
- Off on phones, under reduced motion and in house lights. At rest it costs nothing: the pass returns before sampling when the strength is 0.
- Screenshot: `*-home-hover-mitooshi.jpg`.

## 5. True relative scale (E)

- **One display scale for every sample: real size (×1.0).** The phone is a phone next to the laptop.
- **The tug** is the one scale model: 1:24, 0.28m with the tow bar, on its own plinth with an engraved "1:24" plate (Geist Mono, dark on brushed metal).
- **SHUNYA** sits on a Munsell N5.5 curved sweep card on a higher riser (29cm), instead of the black board.
- **The certificate** is 1.6× larger, on a lower, wider shelf, under its own soft spot.
- **Rows:**
  - front: Bengal, the tug, the tablet;
  - middle, raised: the laptop, Too Yumm, SHUNYA, the phone;
  - back, high: SOOK and the JSW book.
- **The size rule** now measures each sample's long side (its height for a portrait piece like the pouch or phone). The floor is 11% of the cabinet, or 9% on a raised plinth with nothing taller in front (`staging.ts` `sizeFloor`).
  - Smallest: the phone, at 9.1–9.4% (raised plinth, 9% floor). Too Yumm, at 11.9–12.8%, is the smallest sample held to 11%.
  - Worst overlap: 0.5%. Minimum gap: 11.0cm.
- **The honest limit:** at real size, the phone can't reach 11% of a 1.6m cabinet from this lens. The 9% raised-plinth rule is what lets it pass.

## 6. Project headers (F)

- **Per-project framing.** In a tray shot, any neighbour that would overlap the tray object or be cut by the frame edge drops out with its base (`shots.ts` `trayHidden`). The rest stay dimmed and whole. The tray object's own empty plinth always drops out. This fixes the JSW book above the laptop on /work/mitooshi.
- **Screen glass:** coat roughness ~0.12, environment 0.35, and no direct specular from the lamps' small sources, so there is no hot spot.
- **JSW artwork:** desktop now carries WebP at the full 2048, encoded from the lossless PNG art, not the JPEG embedded in the GLB. That removes UASTC+RDO's block grid and softness, and the file is 0.64MB (was 1.52MB). Side by side with `ref-open.png`: `jsw-compare.jpg`.
- **Other models at tray zoom:** @@TEXTURES@@

## 7. Phone staging (G)

- A separate three-tier arrangement of all ten objects for the 4:5 box, at 0.68 × real size (`phoneStaging.ts`, its own AO bake `ao-phone.png`). The tug's plate reads its true ratio at this size.
- Every object is wholly in the frame. The smallest is the phone, at 14.9% of the box width (floor 14%) at 390×844 and 430×932.
- A swipe moves the focus with a short camera lean (≤ 2.5% of the box), never losing an object.
- Phone poster: `poster-phone.webp`. `check-sizes` and `check-picking` run at 390×844 and 430×932.

## 8. Polish (H)

1. "Play with sound" appears only for a video with an audio stream (ffprobe at build, `content/audio.json`). **None of the eight current videos has one**, so the button is hidden everywhere until a video with sound is added.
2. The "CHECKED UNDER… / PASS" row is gone from the calibration label.
3. The lamp pill:
   - shrinks to a dot and the lamp name;
   - docks bottom left;
   - slides away while scrolling down;
   - returns on scroll up or after 1.2s still;
   - never returns over a proof.
4. The Index preview box takes each still's own aspect (max 70svh), with no letterbox.
5. Lazy proofs start loading one screen ahead. `review-shots` full-page captures wait for every image.
6. The manifest is linked with `crossOrigin="use-credentials"` everywhere (it was only on Vercel previews).

## 9. Screenshots

`tools/lamp-review/08/shots/` at 2560×1440, 1568×980 and 390×844:
- `/` under D50, A, SCREEN and AFTER DARK;
- `/` with a hover (phones: a swipe);
- /work/mitooshi, /work/jsw-sports (open), /work/shunya and /work/indo-thai.

Also: `reveal-sheet.jpg` (12 frames, first paint → poster → crossfade → live), `jsw-compare.jpg` and `aa-compare.png`.

## 10. Budgets

@@BUDGETS@@
