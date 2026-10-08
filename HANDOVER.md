# HANDOVER: The Booth (visheshmahendru.com)

## 09A update (8 Oct 2026, read this first)

Batch 09A is PR #7 (`claude/quirky-knuth-70j1df`), squash-merged to `main`; every check in DELIVERY-09A §1 passes (software rendering). Full report: `DELIVERY-09A.md`. The three half-integrated commits from 08's wrap-up (covers 82eb8e1, repaired models e3dea76, lightmap 8cbbcc1) are now fully integrated. **Next: 09B, the responsive shelf system.**

What changed that the next agent must know:
- **Lightmap:** served as `public/booth/lightmap.ktx2` (desktop) and `lightmap-phone.webp` (phones); sources in `assets-src/booth/`. Re-encode with `node tools/encode-lightmap.mjs`. Per-lamp `bake` levels in `lib/lampPresets.ts`. On room surfaces the bake replaces the ceiling panel and the hemisphere (shader patch in `BoothRoom.applyLightmap`, which throws if three's chunks change shape). The 08 tint patch had never applied.
- **Room:** interior normals face inward (FrontSide). Still FROZEN; `tools/booth-room.lock` line 1 is the hash, the rest are history notes (bake-booth keeps them). Positions and UV1 are byte-identical to aa0e153.
- **Models:** `tools/optimize-models.mjs` now does WebP artwork on desktop, drops extra scenes, turns backward `screen` planes, and applies `NUDGE` (sub-millimetre part separations). Re-run it after any new Blender delivery, then `check-coplanar` and `check-sizes`.
- **Posters:** the build also hashes the lightmap and the 18 tray posters (`public/booth/tray/`). `make-posters.mjs` renders home, first-visit, tray posters and the share cards (`public/og/`) in one run (about 60 to 80 min in software). `TRAY=slug` / `TRAY_ONLY=1` narrow it.
- **The opening strike plays on `/` only** now; a deep link into a project shows the lit tray (its poster) at once.
- **New checks:** `check-coplanar`, `mesh-clearance` (in check-sizes), `check-pill`, `check-targets`, `check-axe`, `check-about`, `type-sheet`. check-flicker gained `screen`.
- **Contact:** `contactMailto()` in `lib/site.ts` is the only way to build a contact link (check-07 enforces it).
- **Open for Vishesh:** the RTX frame numbers (DELIVERY-09A §9), the type pick (`?type=a|b|c`), the greyscale portrait, Blender clean-ups listed by `check-coplanar`, the Too Yumm front art resolution, DNS cutover (`LAUNCH.md`).

---

# (Earlier) end of the batch 08 session

This is the wrap-up of one long Claude Code session (4–7 Oct 2026). It covers the original A–I batch, then batches 06, 07, 08 and the 08 follow-up. It is written for the next coding agent, who will receive **prompt 09** next.

**Read in this order:**
1. `BRIEF.md` (founding concept and locked rules).
2. `PROJECT-CONTEXT.md` (the living reference: architecture, routes, storage keys, tools).
3. This file (what happened, what state everything is in, what's unfinished, the traps).
4. `DELIVERY-08.md`, then `DELIVERY-07.md` (the latest detailed reports).

When this file and PROJECT-CONTEXT disagree, this file is newer.

---

## 0. TL;DR: the state you inherit

| | |
|---|---|
| Repo | `github.com/vishhhh999/portfolio-website`, default branch `main` |
| `main` head | **`8cbbcc1` "lightmap"** (Vishesh, 7 Oct). My last merge before it was `a13fa23` (PR #5) |
| Hosting | Vercel project `vishafterdark-projects/portfolio-website`. Every branch gets a preview; `main` deploys to production (www.visheshmahendru.com) |
| Working branch (this session) | `claude/session-access-question-dqidr4`. It is reset to `origin/main` at the start of each follow-up (merged PRs are never reused) |
| Branch preview URL | https://portfolio-website-git-claude-sess-af6eb1-vishafterdark-projects.vercel.app (Vercel SSO-protected: plain curl gets a 302) |
| PRs merged this session | #1 (A–I batch, `e3d6ada`), #2 (06, `651e6e7`), #3 (07, `c8c4b85`), #4 (08, `dbbd732`), #5 (08 follow-up, `a13fa23`) |
| **ROOM FROZEN** | at **`aa0e153`** (08-A). `tools/booth-room.glb` + `tools/booth-room.lock` (sha256 `c02dc86e…`). Vishesh baked the lightmap from it |
| GPU numbers | Only one real measurement exists: Vishesh's RTX 4070 SUPER on **07** (frameP50 13.1ms). **08's effect on the RTX is unmeasured.** Target: p50 ≤ 8ms, p95 ≤ 11ms at 1440p |

### ⚠ Three things changed on `main` after my last merge (by Vishesh, not yet integrated)

None of these has been through the site pipeline or the checks. Treat them as **P0 for 09** (details in §11):

1. **`82eb8e1` "covers"**: nine large PNGs in `assets-src/covers/` (one per project, 3.6–5.4MB each: bengal-t20-league, house-of-hex, indo-thai, jsw-sports, mitooshi, shunya, sonde, sook, too-yumm). They aren't referenced by any code yet. Presumably 09 will say what they're for (project cover images / OG / index previews?). Don't guess: wait for the prompt.
2. **`e3dea76` "Models: Blender batch 3 repair"** (made by another Claude session, "Sonnet 5.5", session_01VL5dqpaQXT9tbMnQbPwybU):
   - Rebuilt **source** GLBs for Mitooshi, Sonde, House of Hex, Too Yumm, SOOK and JSW Sports in `assets-src/models/<slug>/`, with new textures, check sheets, ref renders and READMEs.
   - **`public/models/` was NOT regenerated.** The site still serves the 08 optimised files. You must run `node tools/optimize-models.mjs <slug>` for each, then check sizes and textures.
   - The JSW source grew a lot (glb 1.09 → 5.63MB, mobile 0.34 → 1.73MB).
   - The JSW texture names in `textures/` may have changed: optimize-models' WebP path looks for `textures/<texture name>.png`.
   - Mitooshi's textures were renamed (old `mitooshi_basecolor.png` etc. deleted; new `keyboard_basecolor*.png`, `bead_blast_n*.png`, `logo.png`).
   - Read each README.txt before optimising.
3. **`8cbbcc1` "lightmap"**: `public/booth/lightmap.exr` (3.2MB), `lightmap.png` (4.0MB, 16-bit linear) and `lightmap.README.txt`.
   - `app/(site)/layout.tsx` `boothLightmap()` picks up `booth/lightmap.ktx2` or `booth/lightmap.png` at build time. **So production now loads the 4MB 16-bit PNG on every device, phones included.**
   - I built `main` (8cbbcc1) locally and looked. It renders sensibly (walls slightly deeper, not double-lit). The lightmap tint follows the lamp and the strike (`LampRig.applyRig`: `lightmapTint = fill.sky × (fill + panel×0.25) × env`).
   - **The posters are now stale, and the build didn't catch it:** check-poster on 8cbbcc1 gives desktop 2.99% (FAIL, limit 2.5), phone 2.10% (pass), first-visit desktop 5.47% (FAIL) and first-visit phone 5.67% (FAIL). `tools/poster-hash.mjs` hashes `public/booth/ao.png` but **not** `lightmap.*`, so `--check` still passes. Fix: add `public/booth/lightmap.ktx2` / `lightmap.png` to `FILES` in poster-hash, then regenerate posters.
   - The first-visit diff (5.5%) is larger than expected with env=0. Investigate: maybe the lightmap affects the dark frame through something not scaled by env, or load timing.
   - **Still to do (planned since 06-J):** convert the EXR to **KTX2** (UASTC HDR, or a 16-bit/RGBM approach) so browsers don't get an 8-bit-decoded 4MB PNG. Phones probably shouldn't load it at all (budget), or should get a small 8-bit version. Verify the room under all seven lamps. Re-check SCREEN L* (15–25 on the pouch, book and SOOK) and `measure-brightness` (D50 wall L* ≈ 80, paper ≈ 90) with the lightmap on. When the lightmap exists, SSAO already covers objects only (`roomLightmap.on`).

---

## 1. The people and how to work with them

- **Vishesh Mahendru** (work@visheshmahendru.com, handle vishafterdark): a designer, not a coder. He writes batch prompts (A–I, 06, 07, 08, next 09) with lettered sections, measures on his own RTX 4070 SUPER desktop (Chrome, ~1923×1263 or 2560×1440, DPR 1), and reviews previews visually.
- **His preferences (from his operating instructions):**
  - execute fully, no partial delivery, no "shall I continue";
  - be direct; push back when something is wrong;
  - report outcomes, not logs;
  - short and decision-oriented;
  - he values honesty about what was and wasn't verified.
- **Workflow (PROJECT-CONTEXT §12):**
  1. Work on the branch.
  2. **Commit and push after every lettered section** (containers are ephemeral; an earlier session lost work).
  3. Vercel builds a preview.
  4. Merge to `main` (production) **only when the preview is green**, via a PR (squash merge).
  5. Deliver a `booth-0N.zip` (screenshots, report, context) at the end, sent to the user as an attachment.
  6. Write `DELIVERY-0N.md`, and update `PROJECT-CONTEXT.md`.
- **Don't create a PR unless the batch workflow calls for it.** It always has: every batch ended with PR → green → merge.
- **Commit trailer used this session:**
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RuhKxfnJBpDdXDCHDdVnoZ
  ```
  PR bodies end with "🤖 Generated with [Claude Code](https://claude.com/claude-code)" plus the session link. Your session will have its own values.
- **The locked rules** (PROJECT-CONTEXT §2; all still apply):
  1. No distortion.
  2. Never invent facts.
  3. No em dashes in copy.
  4. Live-site facts are authoritative.
  5. Project images are never relit (only the AFTER DARK torch mask).
  6. The lamp never switches by itself.
  7. House lights is a mode, not a page.
  8. All content in the DOM.
  9. One idea at absurd quality.
  10. Ask before large unrequested changes.

---

## 2. Environment and tooling facts (cloud container)

- Node 22. Playwright at `/opt/node22/lib/node_modules/playwright`. Every tool takes `PLAYWRIGHT=<that path>`. Chromium is at `/opt/pw-browsers`; **never** run `playwright install`.
- **No GPU.** All browser checks run in **SwiftShader** (software WebGL). Consequences:
  - A single 2560 frame takes about 3–11s, and the reveal takes 30–80s.
  - rAF and timers are starved: anything "on the next frame" can lag by seconds. Wait longer in tools, never shorter.
  - Short animations (300ms crossfade, 1.2s strike, the JSW open clip) can't be captured in real time. Use the hold hooks: `window.__boothAnimHold = 0..1` (JSW open clip), `window.__boothStrikeHold = 0..1` (first-visit strike), and the Web Animations API to pause/step CSS transitions (or stretch them via an injected style).
  - Frame times are CPU ms: only the **ratios** mean anything. GPU timing must come from Vishesh's RTX.
- **Production server for checks:** `npm run build` (or `npx next build` to skip the prebuild checks), then `npx next start -p 3100`. The helper used this session (recreate it if the container is new):
  ```bash
  fuser -k 3100/tcp; sleep 1; nohup npx next start -p 3100 > /tmp/next.log 2>&1 &
  ```
  **`next start` only serves `public/` files that existed when it started.** After writing posters or models, restart the server (a new file 404s until then).
- **Never restart the server while a long background check runs** (it breaks the run).
- **Never `pkill -f <pattern>`** when the pattern appears in your own command line: it kills your shell (exit 144). Kill by PID, e.g. `ps -eo pid,args | awk '$2=="node" && $3=="tools/x.mjs"{print $1}' | xargs kill`.
- Foreground `sleep` is blocked by the harness. Use `until <cond>; do sleep 15; done` with a ≤ 590s timeout, or `run_in_background`, and re-arm.
- **Don't run two heavy SwiftShader jobs at once** if timing matters (the frame budget). Checks that only compare pixels tolerate it, slowly.
- `tools/_*.mjs` and `tools/_*.py` are gitignored scratch scripts. `booth-*.zip` is gitignored.
- GitHub access is through the MCP `mcp__github__*` tools (no `gh` CLI). PR activity can be subscribed to (`subscribe_pr_activity`).

---

## 3. Session timeline (what was built, batch by batch)

### Batch A–I (PR #1, merged as `e3d6ada`, 4 Oct)

The first big batch on top of the Phase 0–3 scaffold (`BRIEF.md` phases).
- **A:** the lamp never changes on its own; GSAP replaced by the shared rAF clock (`lib/clock.ts`).
- **B:** the full-colour masters pipeline (`tools/import-masters.mjs`, GitHub release `masters-v1`, AVIF + WebP).
- **C:** glitch fixes (alignment test, MSAA/SMAA, DPR, shadows, perf readout, plate).
- **D:** the realistic 3D booth and GLB pipeline (AgX, PMREM environments, soft and contact shadows, SSAO, AO bake, a 35mm-equivalent lens).
- **E:** live-site content (Framer import).
- **F:** archive cleanup.
- **G:** logos on the booth screens.
- **H:** procedural sound (one bed per lamp plus events).
- **I:** transitions, the spectro loupe (L / Alt), 404, resilience, shortcuts, analytics, loading.
- Report: `DELIVERY.md`.

### Batch 06 (PR #2, `651e6e7`)

- **A:** no stale booth pixels (smear); no frozen project switches.
- **B:** house lights becomes a mode of the current page (never a navigation).
- **C:** project images are never relit; the AFTER DARK torch is a pure luminance mask; real per-image palettes (`content/palettes.ts`).
- **D/E:** full-width layout, floating lamp bar, the About certificate page.
- **F/G/H/I:** composition, SCREEN lit by the device screens, hood and diffuser, active-lamp slug lines.
- **J:** the lightmap path (hook only).
- **K:** housekeeping; PROJECT-CONTEXT.md added.
- Report: `DELIVERY-06.md`.

### Batch 07 (PR #3, `c8c4b85`)

All ten objects, centred layout, project story, interaction, realism, speed. Report: `DELIVERY-07.md`.
- **A:** six new real GLBs (Mitooshi laptop, House of Hex phone, Sonde tablet, the Indo Thai tug, the Bengal T20 set, the rebuilt JSW book with its open animation), device screens with brand logos, `?modelref=<slug>`.
- **B:**
  - the About **certificate** on a shelf, replacing the colour checker and test strip;
  - ten-object staging and the 11% size rule;
  - **picking**: a click opens only what's seen (`check-picking`);
  - brightness calibration (D50 wall L* ~80, paper ~90; `measure-brightness`).
- **C/D/E:**
  - the centred home column;
  - the phone portrait booth (a cropped landscape booth at the time);
  - the floating panel;
  - the Index ⇄ 3D view switch;
  - the project story layout;
  - the About live IST clock.
- **F/G:** Mitooshi media (GIF loops → H.264/VP9), archive titles, clips, chips.
- **H:** speed:
  - GPU readbacks only under `?perf` or the loupe;
  - `frame-budget.mjs`;
  - responsive AVIF/WebP proofs at 640/1200/1800/2400;
  - model streaming in view priority;
  - mobile models as WebP (no Basis transcoder on phones).
- **I/J/K:** the turntable (drag / arrow keys, inertia), realism passes, tests, delivery.
- Fixes at the end of 07:
  - the smear fix (`toViewport` uses `window.scrollY`);
  - ProofStrip videos `preload="none"`, IO rootMargin 25%;
  - `trayW` / `trayX` for the open JSW book;
  - env capture on the lamp's first frame at full output.

### Batch 08 (PR #4, `dbbd732`), then the follow-up (PR #5, `a13fa23`)

The full spec is in the prompt Vishesh pasted (the "08: FRAME BUDGET + NO FLICKER + …" text); `DELIVERY-08.md` maps every item. What was done:

**A. Room change, then freeze** (commit `aa0e153`):
- The housing header band was halved (`CABINET.header` 0.09 → 0.045m, chamfer kept). The stage box takes the cabinet's aspect (`CABINET_FACE.w / CABINET_FACE.h` ≈ 1.707), so the height goes to the interior.
- `shell.ts addAtlasUv` packs the ROOM set (interior, frame, housing, hood, diffuser, lip) first, so room UV1 never moves when bases change. Later (E) the movable parts also step their texel density down until they fit, rather than overflowing the 1024 atlas.
- `tools/bake-booth.mjs` refuses to rewrite `booth-room.glb` unless its sha256 matches `tools/booth-room.lock`, or `ROOM_UNFREEZE=1`.
- **"ROOM FROZEN at aa0e153."**

**B. Frame budget:**
- `lib/dirty.ts`: dirty flags per system (`reflector`, `shadow`, `normals`), `markDirty(reason, systems, frames)`, `takeDirty`, `isDirty`. Shown in the `?perf` overlay with counts.
- The floor reflector (`components/booth/vendor/gatedReflector.js`, a copy of drei's MeshReflectorMaterial with a `gate` prop), the shadow map and the SSAO normals re-render only on change: camera, lamp, object transform, view rect, DPR, model load, hover light, strike.
- VSM shadows (`no=vsm` back to PCF + PCSS).
- **One combined screen light** on desktop (`no=screencombine` restores per-screen RectAreaLights). SCREEN reads pouch 19.3 / book 22.4 / SOOK 20.8 L* (target 15–25).
- **MSAA 4x kept**: SMAA dashes the thin frame-chamfer highlights, which crawl under parallax. Crops: `tools/lamp-review/08/aa-compare.png`.
- `window.__boothPasses(n, moving)` returns the per-pass table: `moving=true` forces every system dirty.
- SwiftShader result: a still frame costs 76% of a moving one; NormalPass 1.4 vs 54.8; scene prep 350 vs 896 (`tools/lamp-review/08/frame-budget-swiftshader.md`).

**C. No flicker:**
- **The LCP poster is the live booth.** `tools/make-posters.mjs` crops `.booth-frame`:
  - desktop: 1568×980 @2, out to `poster-cabinet-1200/2400.webp` + `.jpg`;
  - phone: 390×844 @2, out to `poster-phone.webp`;
  - **first visit:** `poster-cabinet-dark-1200/2400.webp` and `poster-phone-dark.webp`.
- `public/booth/posters.json` records the inputs' hash **and each poster file's own sha256**.
- `tools/poster-hash.mjs --check` runs in `npm run build` and fails on stale inputs or a swapped poster file. **It doesn't yet hash the lightmap (see §0).**
- `tools/check-poster.mjs` compares each poster with the live render (limit 2.5%), including the first-visit pair.
- **Reveal** (`BoothCanvas` ClockBridge, `lib/reveal.ts`): after ≥ 3 frames, the visible models settled and the lamp's environment captured (desktop), it compiles synchronously, renders one more frame, then sets `revealed.value = true`. `onReady` sets `html[data-booth-ready]`, so CSS fades `.booth-poster` out over 300ms. Safety reveal after 15s. Models arriving later fade in over 250ms.
- **No runtime pass add/remove.** HoverLight and CertificateSpot are always in the scene at intensity 0, because toggling a light's visibility recompiles every material.
- **Idle pre-capture** of every lamp's environment after the reveal (`LampRig` precapture).
- **Contact-shadow re-bake** after a spin crossfades over 200ms.
- **`?perf&events`**: an on-screen event log (`lib/eventLog.ts`).
- **The lamp-blink bug, fixed:** after the first-visit opening, every lamp change used to replay its strike from black. Now **only the J5 first-visit opening strikes from dark**. A lamp change is at full output from its first frame; FLOOD keeps its exposure overshoot (brighter only). Done in `LampRig.applyRig`: when `!opening`, channels = `strikeChannels(curve, 1)` + the live exposure; Kelvin ramp only while opening.
- **The first-visit jump, fixed (in PR #5):**
  - The lit poster used to crossfade into a black booth before the strike (light → dark → light).
  - The boot script (`app/layout.tsx` HOUSE_LIGHTS_BOOT) now sets `html[data-opening]` when `!sessionStorage vm:opened:v1 && !house lights && (lamp unset || D50) && !prefers-reduced-motion`. These are the same conditions as `prepareOpening()`.
  - CSS then hides the lit `<img>` and shows the dark poster as a `.booth-poster` background (`image-set`, phone media query), fetched only on that visit.
  - The certificate spot and the hover key now scale with `strikeChannels('opening', p).light`.
- **check-flicker** (`tools/check-flicker.mjs`) covers:
  - reveal: composited captures, plus poster vs live ≤ 4%;
  - hover on/off on every sample under D50 and A;
  - lamp change D50 → A → D50: "dip below both sides" metric; waits for the A precapture;
  - turntable spin and release;
  - JSW open.
- **Proved:** 07's actual poster fails the build hash check, check-poster (44.3%) and check-flicker's reveal (44.3%).

**D. Masked hover focus** (replaced depth of field, `Post.tsx` `BoothFocusEffect`):
- `renderFocusMask` draws the hovered sample's meshes (the `focusRoot` group) into a half-resolution mask (additive MeshBasic, colour = weight).
- Outside the mask: a blur of 2.5·h/1440 px with a 6·h/1440 px feather. It returns early at strength < 0.003.
- Ramps 0 → 1 in 250ms, 1 → 0 in 300ms; crossfades between samples; the tray object rests at 0.6.
- Off on the mobile tier, under reduced motion and in house lights. `no=focus` switches it off.
- `HoverLight.tsx`: a soft SpotLight (not an area light: cheaper) giving ≈ +12% on the hovered sample, in the key colour, room lamps only.
- **Bug found and fixed:** hover never reached the booth because the faded poster `<img>` sat over the canvas and caught the pointer. `.booth-poster` / img are now `pointer-events: none`.

**E. True relative scale** (`components/booth/staging.ts`):
- One display scale: **K = 1.0 (real size)**.
- The tug is a **1:24 model** (`TUG_SCALE = 1/24`, 6.73m → 0.28m) with an engraved plate (`ScalePlate` in ObjectSlot: canvas texture, Geist Mono, brushed metal; text from `st.plate`).
- SHUNYA sits on an **N5.5 sweep card** (`#848484`, `sweep: {w .46, h .12, r .05}`) on a 0.29m riser.
- **Certificate** at 1.6× (0.256 × 0.192m) with `CertificateSpot`; shelf at x .52, y .505, w .34.
- Rows:
  - front: Bengal (x −.5), tug (.04), Sonde (.5);
  - middle: Mitooshi (−.5, plinth .24), Too Yumm (−.16, z −.1, plinth .15), SHUNYA (.235), House of Hex (.6, plinth .32, z −.03);
  - back (z −.37): SOOK (−.42, plinth .53, z −.385), JSW (.04, plinth .42).
- **Size rule** (`sizeFloor`): the **long side** (width, or height for a portrait piece) ≥ 11% of the cabinet width, or ≥ 9% on a raised plinth (≥ 0.2m) with nothing taller in front.
  - Results: the phone is 9.1–9.4% (it can't reach 11% at real size); Too Yumm is 11.9%+.
  - Worst overlap 1.0% (at 725). Minimum gap 11.0cm.
- **Offline planner:** `node --experimental-strip-types tools/stage-plan.mjs [W H]` (`V=1` for boxes, `PHONE=1` for the phone layout).

**F. Project headers (tray shots):**
- `shots.ts trayHidden(slug, aspect)`: every neighbour that would overlap the tray object's projected box, or isn't wholly inside the frame (2% margin), drops out with its base. The active sample's own empty plinth always drops out.
- **Screen glass:** clearcoat roughness 0.6 × smudge map ≈ 0.12, envMapIntensity 0.35, **and no direct clearcoat specular** (patched `clearcoatSpecularDirect = 0` after `lights_fragment_end`). The hot spot was the key light, not the env.
- **JSW:** desktop textures are WebP 2048 from the lossless PNG in `textures/` (`SIZES['jsw-sports'].desktop.webp: 92` in optimize-models); 1.52 → 0.64MB.
- **The real sharpness fix:** 8× anisotropic filtering on all model artwork (ObjectSlot). The angled pages were smeared by trilinear filtering.
- **The "grid" on the JSW pages is authored in the artwork** (also faint in the Blender reference). I left it, and flagged it to Vishesh.
- Every model checked at tray zoom: `tools/tray-zoom.mjs`, `tools/lamp-review/08/tray-zoom/`. Note: the new source models from `e3dea76` aren't optimised yet.

**G. Phone staging:**
- `components/booth/phoneStaging.ts`: all ten objects in three tiers at **PHONE_K = 0.68** inside the 4:5 box (same room, a crop of its middle; the room is frozen). The tug's plate reads its true ratio (`1:35`). The certificate sits on its own shelf (x −.12, y .565).
- `staging.ts` exports `PHONE_LAYOUT = window.innerWidth < 600 at load`, and switches `STAGING`, `PROPS` and `CERTIFICATE`. **It is chosen once, at load.**
- Phone AO bake: `LAYOUT=phone node --experimental-strip-types tools/bake-booth.mjs` → `public/booth/ao-phone.png`.
- Swipe order: front row L→R, then middle, then back. It starts on the centre sample (`BoothFrame` re-sorts after mount). The camera **leans** ≤ 2.5% of the box toward the focused sample (`cabinetShot` portrait).
- Every object is ≥ 14% of the box width (smallest: the phone, 14.9%). check-sizes and check-picking run at 390×844 and 430×932 (phone gap rule ≥ 5cm, everything in frame).

**H. Polish:**
1. `tools/probe-audio.mjs` (in the build; ffprobe if present, else the committed `content/audio.json`): "Play with sound" shows only for videos with an audio stream. **None of the eight current videos has one**, so the button is hidden everywhere.
2. The "CHECKED UNDER… / PASS" row is removed from the calibration label (`SpecPlate`).
3. **Lamp pill (final version in PR #5):** centred, dot + lamp name.
   - At load it rides the booth header's bottom edge (`--pill-lift` CSS variable set by `SwitchPanel`) while that edge is in the lower two-thirds of the screen.
   - Below that it takes the bottom slot: away while scrolling down, back on scroll up or after 1.2s idle.
   - Never over a `.proof__image`: it decides every animation frame while Lenis is easing the scroll.
4. Index preview box: each still's own aspect, max 70svh, `object-fit: cover`.
5. Lazy proofs flip to eager one screen ahead (IO rootMargin 100%). `review-shots` full-page captures wait for every image.
6. The manifest moved to a route handler `app/manifest.webmanifest/route.ts`. `<link rel="manifest" crossOrigin="use-credentials">` sits in the layout head; Next only adds it on Vercel previews otherwise.

**I. Delivery:**
- `DELIVERY-08.md`, `PROJECT-CONTEXT.md` updates, `booth-08.zip`.
- Screenshots in `tools/lamp-review/08/shots/`:
  - 2560×1440, 1568×980 and 390×844;
  - home under D50, A, SCREEN and AFTER DARK, plus hover (phone: swipe);
  - /work/mitooshi, /work/jsw-sports (held open), /work/shunya, /work/indo-thai.
- `reveal-sheet.jpg`: 12 frames, dark poster → crossfade → strike.
- `jsw-compare.jpg`, `aa-compare.png`, `tray-zoom/`.
- **Budgets (08):**

  | | Target | 08 |
  |---|---|---|
  | JS before 3D | ≤ 200KB | 181.6KB gz |
  | Lazy 3D chunk | ≤ 460KB | 427.3KB gz |
  | Models, desktop | ≤ 6MB | **8.77MB, over** (SHUNYA 2.09, Bengal 1.47) |
  | Models, mobile | ≤ 2.5MB | 2.22MB |

---

## 4. Architecture you must understand before touching anything

- **One canvas, one clock.**
  - One fixed, transparent, full-screen `<canvas>` (`BoothCanvas`, mounted by `BoothHost` in `app/(site)/layout.tsx`) survives route changes.
  - `lib/views.ts` tracks DOM rects (the booth stage, proof planes), and the canvas scissors into them. The camera's projection spans the whole canvas via `setViewOffset`.
  - `lib/clock.ts` is the single rAF loop: Lenis smooth scroll, strikes and render-on-demand (`setRunState('active'|'idle'|'paused')`). R3F runs `frameloop="never"`, and `advance()` is called by the clock.
  - Render on demand: `invalidate()` / dirty flags. **A frame that changes nothing shouldn't render.**
- **Post chain** (`Post.tsx`, pmndrs postprocessing):
  - `ViewsPass` → `BoothNormalPass` (gated by the `normals` dirty flag) → `CoveragePass` → ShaderPass (sanitize) → EffectPasses.
  - Effects: tone map (PBR Neutral for room lamps, AgX for dark lamps), focus, SSAO, bloom, colour matrix, grain.
  - **Every effect exists from the first frame.** Animate uniforms; never add or remove passes at runtime.
- **Lamps:**
  - Presets: `lib/lampPresets.ts` (key light, fill, panel, screens, strike curve, ENV_INTENSITY).
  - Switching: `lib/lampController.ts` (`switchLamp`, `prepareOpening`, `runOpening`; review hook `__boothStrikeHold`).
  - `components/booth/LampRig.tsx` `applyRig(rawDt, override?, lampOverride?)`.
  - The environment (PMREM of the real interior) is captured per lamp: `environment.ts`, plus the precapture.
- **Samples:**
  - `ObjectSlot.tsx` loads each GLB (`models.ts`: view-priority queue, two at a time; KTX2 + meshopt desktop, WebP mobile; phones wait for first scroll/touch for non-visible models).
  - It handles: UV/ink shader (`uvMaterial.ts`), screens (`deviceScreen.ts`, `screens.ts`), contact shadows, hover lift, turntable (`lib/spin.ts`), tray move, dimming, tray hiding, picking (≥ 60% in view), sweep card, scale plate.
- **Staging and shots:** `staging.ts` (desktop + `PHONE_LAYOUT` switch), `phoneStaging.ts`, `shots.ts` (`cabinetShot` contain-fit with lens shift, `trayShot`, `trayHidden`), `CameraRig.tsx` (on-rails moves, parallax ≤ 1.5° yaw / 0.6° pitch, desktop pointers only).
- **Room:**
  - `shell.ts` builds the shell geometry plus its UV1 atlas (1024, 260 px/m; room packed first).
  - `BoothRoom.tsx` holds the materials, AO (`ao.png` / `ao-phone.png`), lightmap hook, diffuser and hood.
  - **Don't change room geometry** (frozen; the lightmap depends on it).
- **Debug and window API:**
  - `?perf` (overlay, `__boothPasses`, `__boothBench(n, moving)`, `__boothPerf`).
  - `?perf&events`.
  - `?perf&no=ssao,vsm,pcss,screencombine,screenlights,reflector,msaa4,msaa,focus,contact,envcapture,bloom`.
  - `?gpu=high|low`, `?tier=mobile`, `?tone=agx|neutral`, `?exposure=`, `?viewdebug[=cabinet]`, `?lampdebug`, `?modelref=<slug>`.
  - Window hooks: `__boothSizes`, `__boothSizeFloors`, `__boothBoxes`, `__boothPickAt(x, y)`, `__boothProbePoints`, `__boothCapture`, `__boothAnimHold`, `__boothStrikeHold`, `__boothStageRect`.
- **Storage keys:**

  | Key | Where | Meaning |
  |---|---|---|
  | `vm:lamp:v1` | session | Current lamp |
  | `vm:houseLights:v2` | local | Visitor chose house lights |
  | `vm:autoHouseLights:v1` | session | Slow GPU switched house lights on |
  | `vm:opened:v1` | session | First-visit opening done |
  | `vm:sound:v1` | local | Sound on |

  Boot attributes on `<html>`: `data-lamp`, `data-house-lights`, `data-opening`, then later `data-booth-ready`.

---

## 5. Tests: what exists and how to run it

Run against a production build on :3100 with `PLAYWRIGHT=/opt/node22/lib/node_modules/playwright node tools/<x>.mjs`. Each takes minutes in SwiftShader; the full suite takes over an hour.

| Check | Proves | Last result |
|---|---|---|
| `check-flicker` | No dips: reveal (+ poster vs live ≤ 4%), hover D50/A, lamp change, spin, JSW open (`ONLY=reveal,hover,lamp,spin,jsw`) | PASS on a13fa23 |
| `check-poster` | Posters vs live (repeat and first visit) ≤ 2.5% | PASS on a13fa23; **FAILS on 8cbbcc1 (lightmap)** |
| `poster-hash --check` | Build gate (inputs + poster file hashes) | Passes on 8cbbcc1, but only because the lightmap isn't hashed |
| `check-sizes` | Size rule, overlap ≤ 3%, gaps (desktop ≥ 8cm; phones ≥ 14%, all in frame, ≥ 5cm) | PASS |
| `check-picking` | Clicks open only what is seen; all routes at 1568, 390, 430 | PASS (30/30) |
| `check-views` | Booth drawn on its DOM rect (≤ 2px or 0.1% of width) | PASS (the cabinet is fit 1px inside its frame) |
| `check-layout` | Centred stage at the cabinet aspect, booth + panel in one screen | PASS 43/43 |
| `check-smear`, `check-houselights`, `check-lamp`, `check-sound`, `check-07`, `check-switch`, `check-overflow`, `check-redirects` | Regressions | PASS |

Measurement and review tools:
- `measure-screen.mjs`: SCREEN L*.
- `measure-brightness.mjs`: wall and paper L*.
- `frame-budget.mjs`: per-pass table (`FEATURES=` env).
- `aa-compare.mjs`.
- `shots-08.mjs [2560|1568|390|jsw|reveal]`.
- `tray-zoom.mjs [slug…]`.
- `jsw-compare.mjs <out.png>` / `--sheet a b`.
- `stage-plan.mjs`.
- `metrics.mjs`: JS gz before/after 3D, paint.
- `review-shots.mjs`.
- `model-ref.mjs`.
- `make-posters.mjs` (`DARK_ONLY=1` to render only the first-visit posters).
- `bake-booth.mjs` (`LAYOUT=phone`).
- `optimize-models.mjs [slug]` (`TIERS=desktop|mobile`).
- `probe-audio.mjs`.
- `poster-hash.mjs`.

**When you change anything that shapes the booth's first frame** (staging, shell, lamps, materials, models, AO, the lightmap once hashed, Certificate, Post), the build will refuse until you run:

```bash
npx next build && <restart :3100>
node tools/make-posters.mjs      # ~25 min in software; writes all 7 posters + posters.json
<restart :3100>
node tools/poster-hash.mjs --check
```

Commit the posters with the change.

---

## 6. Decisions made (and why), so you don't undo them by accident

- **MSAA 4x over SMAA:** SMAA crawls on the 4mm frame chamfers at 1440p. Switchable with `no=msaa4` / `no=msaa`.
- **Lamp changes don't strike** (only the first-visit opening does): the strike from black read as flicker. Don't reintroduce a per-switch blackout.
- **Masked focus, not depth of field:** all samples sit at about the same depth.
- **Spot light for the hover key, not a RectAreaLight:** cheaper (LTC per fragment). Always in the scene at 0 so nothing recompiles.
- **True scale (K = 1)**, with the phone allowed down to 9% on a raised plinth. Don't scale objects up to pass the size rule.
- **The JSW page grid is authored art.** Left as is pending Vishesh's call.
- **Phone layout is chosen at load** (resizing across 600px doesn't switch it).
- **Posters are rendered from the live booth.** Never hand-edit them; the hash gate catches a swap.
- **The room is frozen.** Base and shelf changes are fine (they aren't in `booth-room.glb`); room geometry changes need `ROOM_UNFREEZE=1` **and** a new lightmap bake from Vishesh.

---

## 7. Open items and known issues (carry into 09)

**P0: integrate Vishesh's post-merge commits (§0)**
1. **Lightmap:**
   - Add it to the poster hash.
   - Convert it to KTX2, or decide on a format: avoid shipping a 4MB 16-bit PNG, which browsers decode to 8-bit. Consider skipping it on the mobile tier.
   - Verify all seven lamps and the first-visit dark frame.
   - Re-measure SCREEN L* and brightness.
   - Regenerate the posters.
   - Re-run check-poster and check-flicker.
2. **Repaired source models (`e3dea76`):**
   - Read the READMEs.
   - Run `optimize-models.mjs` for mitooshi, sonde, house-of-hex, too-yumm, sook and jsw-sports.
   - Make sure the JSW WebP path finds its PNGs.
   - Re-check desktop totals (already over 6MB), tray zoom, screens (UV0 `screen` mesh names), the JSW open clip (`__boothAnimHold`), `ObjectSlot` m.layout/frontSide flags in `models`/content, and staging sizes (object dims in `staging.ts` are the 08 real sizes; if the new models changed dimensions, `STAGING.object` must match the GLB bounds).
   - Re-bake AO only if bases change.
   - Regenerate the posters.
3. **Covers (`82eb8e1`):** unused so far. Wait for 09's instructions.

**P1: measurements only Vishesh can make**
- RTX `__boothPasses(30)` and `(30, true)` on 08 + lightmap. If p50 > 8ms, try `no=msaa4` first, then `no=reflector`, `no=ssao`.
- Real phone check of the phone arrangement, swipe and lean.
- iPhone fps (≥ 50 target) and PageSpeed on the live booth pages.

**P2: known gaps**
- Desktop models are 8.77MB, over the 6MB budget. Candidates: SHUNYA 2.09MB, Bengal 1.47MB. This may change after the repaired models are optimised.
- The phone (House of Hex) is at 9.1–9.4% under the raised-plinth exemption; it can't reach 11% at real size.
- The JSW book held open at 2560: the left page's lower corner can run past the stage bottom (the tray framing fits by `trayW` only).
- `PROJECT-CONTEXT.md` §8 Lighthouse figures are from batch 06.
- The first-visit dark poster's trapezoid silhouette is correct (the lit interior isn't visible), so it isn't a bug.
- `check-sound` must start past the first-visit strike (it does now); any new steady-state check should set `sessionStorage vm:opened:v1 = 1` in an init script.

---

## 8. Files changed this session (map)

- **`components/booth/`:**
  - BoothCanvas (reveal gating, probes, bench)
  - BoothFrame (poster `<picture>`, phone swipe order, fit)
  - BoothHost (reveal, opening)
  - BoothRoom (lightmap, AO per layout)
  - CameraRig
  - Certificate (1.6×, spot)
  - HoverLight (new)
  - LampRig (dirty flags, combined screen light, precapture, no-strike switches)
  - ObjectSlot (fades, crossfades, tray hiding, sweep, plate, anisotropy)
  - Post (dirty normals, focus mask, passes table)
  - deviceScreen (glass)
  - phoneStaging (new)
  - shell (atlas packing, per-layout params)
  - shots (trayHidden, phone lean, 1px fit inset)
  - staging (true scale, sizeFloor, PHONE_LAYOUT)
  - vendor/gatedReflector.js (new)
- **`components/ui/`:** SwitchPanel (pill), ProofStrip (sound gating, prefetch), HomeIndex (aspect), SpecPlate (row removed).
- **`lib/`:** dirty.ts, eventLog.ts and reveal.ts (new), clock.ts (run-state log), lampController.ts (strike hold).
- **`app/`:**
  - layout.tsx (boot script `data-opening`, manifest link);
  - manifest.webmanifest/route.ts (moved from manifest.ts);
  - globals.css (poster, pill, index preview, calibration label);
  - (site)/layout.tsx (lightmap resolution; unchanged logic).
- **`tools/`:** see §5.
- **`public/booth/`:** ao.png, ao-phone.png, 7 posters, posters.json, lightmap.* (Vishesh).
- **`content/audio.json`.**

---

## 9. Suggested first hour for the 09 agent

1. `git fetch origin main && git checkout -B <your branch> origin/main`. Read BRIEF, PROJECT-CONTEXT, this file and DELIVERY-08.
2. `npm ci` (postinstall patches the r3f timer), then `npm run build`. It passes today, but with stale posters: see §0.
3. Read prompt 09 against §7. If 09 doesn't mention the lightmap or the repaired models, raise them with Vishesh in your plan: they're already on production in a half-integrated state (the lightmap is live and the posters are stale; the models are not live).
4. Keep the workflow: commit and push per lettered section, PR → green preview → squash merge, `DELIVERY-09.md`, `booth-09.zip`, PROJECT-CONTEXT update.
