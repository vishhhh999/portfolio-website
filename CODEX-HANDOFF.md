# CODEX HANDOFF: batch 09B (responsive system by screen shape)

Written 8 Oct 2026 at the end of a Claude Code session, so another agent (ChatGPT Codex) can finish batch 09B. Everything you need is in this file and the repo docs it points to.

---

## 0. THE PROMPT (paste this into Codex as your first message)

```
You are taking over batch 09B of Vishesh Mahendru's portfolio site, THE BOOTH
(github.com/vishhhh999/portfolio-website). The work is on branch
claude/quirky-knuth-70j1df, open as draft PR #8 against main. Main is production
(Vercel). Do not touch DNS.

Read these files in the repo, in this order, before doing anything:
  1. CODEX-HANDOFF.md      (this handoff: state, what is left, exact commands, pitfalls)
  2. PROJECT-CONTEXT.md    (the living reference: architecture, routes, tools, rules)
  3. HANDOVER.md           (the session wrap-ups, newest first)
  4. DELIVERY-09B.md       (the 09B report draft; fill its SUITE: placeholders)
  5. DELIVERY-09A.md, BRIEF.md (background)

The code for 09B is done and committed. What is left is: re-render the home
posters once (the last commit changed the first frame), run the regression
suite, take the delivery screenshots, finish DELIVERY-09B.md, update
PROJECT-CONTEXT.md and HANDOVER.md, mark PR #8 ready, squash-merge to main only
after the Vercel preview is green and every check passes, then report the merge
commit hash. Follow section 4 of CODEX-HANDOFF.md step by step.

Locked rules (never break): no distortion effects; never invent facts; no em
dashes in any copy or file you write; the lamp never switches by itself; project
images are never relit (AFTER DARK luminance mask only); house lights is a mode;
all content in the DOM, canvas aria-hidden; no runtime post-pass add/remove; no
GPU readback in production except ?perf or the loupe; the booth room geometry is
FROZEN; commit and push after every step; ask before large unrequested changes.

The owner is a designer, not a coder. Report outcomes, not logs. Be honest about
what was only verified in software rendering (no GPU).
```

---

## 1. Who and what

- **Owner:** Vishesh Mahendru ("Vish", handle vishafterdark), visual and brand designer in India, job-hunting abroad. Wants complete execution, direct honest reports, outcomes not logs. **Never use em dashes in any copy or file. Never invent facts. Never mention his personal side projects in site copy.** Contact: work@visheshmahendru.com.
- **Site:** THE BOOTH, a real-time WebGL colour viewing booth. Nine projects are 3D objects inside a grey booth; the navigation is lamp switches (keys 1 to 7: D50, TL84, A, UV, FLOOD, SCREEN, AFTER DARK). Key I = house lights, a mode that swaps any page to its flat no-3D version in place. Headline "Tested under / every light."
- **Repo / hosting:** github.com/vishhhh999/portfolio-website, `main` = production. Vercel project `vishafterdark-projects/portfolio-website`; every branch gets an SSO-protected preview. The domain www.visheshmahendru.com is still on Framer; the cutover (`LAUNCH.md`) is Vish's job. **Never touch DNS.**
- **Stack:** Next.js 16 App Router, React 19, TypeScript, three 0.186, @react-three/fiber 9, drei 10, postprocessing 6, Zustand, Lenis, Geist + Geist Mono, one rAF clock (`lib/clock.ts`).

## 2. Locked rules (from the briefing; never break)

1. No distortion anywhere (no displacement, noise warp, RGB split, chromatic aberration, wobble). Light is the only thing that changes. Film and paper grain are allowed.
2. Never invent facts. Live-site facts win; corrections live in `content/work/corrections.ts`.
3. No em dashes in any copy.
4. The lamp never switches by itself. Every route loads under D50 unless the visitor picked a lamp (sessionStorage `vm:lamp:v1`). A project's native lamp is offered as a chip, never forced.
5. Project images (proofs) are never relit. Only exception: AFTER DARK, a 2D luminance mask over the untouched img.
6. House lights is a mode, remembered only if the visitor chose it (localStorage `vm:houseLights:v2`). A slow GPU sets session-only `vm:autoHouseLights:v1`.
7. All content lives in the DOM; the canvas is presentational and aria-hidden.
8. No runtime post-pass add/remove. Every effect stays in the chain and animates uniforms.
9. No GPU readback in production except `?perf` or the loupe.
10. Commit and push after every step. Ask before large unrequested changes; once direction is set, execute fully.
11. The ROOM is FROZEN (`tools/booth-room.glb` + `tools/booth-room.lock`). No room geometry change without `ROOM_UNFREEZE=1` and a new bake.
12. Commit trailers used so far (keep the style, use your own identity): commit messages end with a co-author line; PR bodies end with a generated-by line. Never put model identifiers in commits or PRs.

## 3. State of 09B at handoff

### Branch and PR
- Branch `claude/quirky-knuth-70j1df`, head **6cd5f33**. Restarted from `main` (09A merged as 4653284) at the start of 09B.
- Draft **PR #8**: https://github.com/vishhhh999/portfolio-website/pull/8 . One PR comment explains why the Vercel deploys fail mid-batch (the poster gate).
- **The Vercel preview is RED at 6cd5f33, by design:** the last commit changed the first frame (the vignette box), so `tools/poster-hash.mjs --check` (run by `npm run build`) refuses the old posters. Re-rendering the home posters (section 4, step 2) fixes it. The previous head 8a92d71 was green.

### What 09B asked for (the batch prompt, summarised)
- **L1** a shape classifier (`lib/shape.ts`): `wide | square | tall | phone-landscape` by visual-viewport width over the SMALL viewport height (svh), thresholds 0.88 and 1.3, ±0.04 hysteresis, debounced 150ms, only on > 2% change; columns 2 below 600px, 3 from 600px; `?shape=` override; shape and aspect in the `?perf` overlay.
- **L2** live switching without a flash: staging, shot, poster and AO selected by shape at runtime; hold the last frame until the new layout has rendered one full frame, then a 250ms CSS crossfade; models and textures shared; lamp kept, hover cleared, picking rebuilt, turns kept; iPad rotation and window drags across thresholds clean both ways with no frame dipping > 5% and no horizontal scroll; the first load picks the right poster.
- **L3** layouts: WIDE = the 09A cabinet fitted to the full stage width, no side band > 3% of the width; SQUARE = a taller cabinet with three tiers, objects ≥ 12% of the frame; TALL = THE SHELF (2 columns on phones, 3 on portrait tablets, about 5 shelves, engraved labels, scroll-linked dolly, tap opens, sideways drag turns, vertical swipe scrolls, the lamp panel never covers a label or the tapped object, the JSW book closed, the tug keeps its plate, the certificate its own slot, own posters, own AO bake, own lock once Vish approves, objects ≥ 14% of the frame at true scale); project tray headers reframed for tall and square; DOM pages must not regress.
- **L4** house lights builds no shelf and runs no WebGL; reduced motion: fixed camera pose per shelf, no turntable inertia.
- **L5** picking only on visible objects per shape; keyboard Up/Down in shelf order, Enter opens, Left/Right turn; focus ring; screen readers get the list in shelf order.
- **L6** posters: wide, square, tall phone, tall tablet, each light and dark; make-posters renders them, posters.json records hashes, check-poster compares, poster-hash gates the build.
- **L7** tests at these viewports (width x svh height): 390x664, 393x659, 393x852, 430x932, 750x393, 932x430, 768x1024, 820x1180, 1032x1230, 1032x1260, 1376x940, 1376x980, 1180x820, 1024x1366, 1440x900, 1568x980, 1920x1080, 2560x1440; checks check-layout, check-sizes, check-picking, check-overflow, check-poster, check-flicker (with a resize sequence), check-views, check-houselights, check-lamp, check-smear, check-switch; a live resize test 2560x1440 → 1376x940 → 1032x1230 → 393x659 → back plus a rotation 1032x1230 ↔ 1376x980; a toolbar test (393 wide, height 659 ↔ 750, layout must not change).
- **L8** screenshots for every L7 size of `/`, plus `/work/sook` and `/about` at 390x664, 1032x1230, 1376x940, 1568x980; a table (viewport, shape, columns, shelves, smallest object %); resize and toolbar results; posters and checks green; budgets; ?perf commands for the RTX and iPhone/iPad; what to test by hand; the preview URL, then the merge hash. Update PROJECT-CONTEXT.md and HANDOVER.md.

### Done (committed and pushed)
| Item | Where | Status |
|---|---|---|
| L1 classifier | `lib/shape.ts` (`classifyShape`, `useShape`, `startShape`, `shapeBootScript`, `onBeforeShapeChange`), boot script in `app/layout.tsx`, `?perf` line in `PerfProbe.tsx` | **Verified**: `tools/check-shape.mjs` passes every L7 viewport (boot and runtime agree), the toolbar test, window drags across 0.88 and 1.3 both ways, the iPad rotation, `?shape=` |
| Arrangements registry | `components/booth/staging.ts`: `LayoutKey` = `wide`, `square`, `shelf2`, `shelf3`, `shelf4`; `STAGING`/`PROPS`/`CERTIFICATE` are live views of the active one; `layoutKeyFor(shape, columns, route)`; `PHONE_LAYOUT` removed | Done |
| The shelf | `components/booth/shelf.ts` (rows `ROWS2/3/4`, geometry, own uv1 atlas), `ShelfUnit.tsx` (materials, engraved label rails, label rects for the panel), AO `public/booth/ao-shelf{2,3,4}.png` from `tools/bake-shelf.mjs` | Done. **Not locked** (Vish approves first, then `SHELF_LOCK=1 node --experimental-strip-types tools/bake-shelf.mjs`) |
| Live switching | `layoutSwitch.ts`, `useLayout.ts`, `LayoutGate` in `BoothCanvas.tsx` (copies the frame on screen into a 2D canvas over the WebGL one, applies the layout, waits for the tree, AO and shaders, one full frame, then 250ms crossfade) | Done; manually verified through the whole resize sequence (right layout at every step, no sideways scroll) |
| Camera | `shots.ts` `shelfShot` (no pitch, distance 2.6 unit widths, eye at a fixed screen height = frame top on the page + 0.42 × frame width, off-centre projection via `setViewOffset`; reduced motion = fixed pose per row), `CameraRig.tsx` (no pointer parallax on the shelf) | Done |
| Lamp rig on the shelf | `LampRig.tsx`: panel becomes a softbox above/in front, key stands back with intensity corrected for the longer throw, no environment capture on the shelf | Done (looks right in software; real GPU look unverified) |
| Frame and pages | `BoothFrame.tsx` (sizes per shape: wide band rule, square = 4-col shelf whole, tall = shelf full width; poster picked by an inline boot script), `BoothHost.tsx` (tray poster per shape), `SwitchPanel.tsx` (panel floats on the tall shelf, steps away from labels and from the touched sample), CSS block at the end of `app/globals.css` (L3 09B section), phone-landscape masthead tagline in `app/(site)/layout.tsx` | Done |
| Picking / keyboard | `ObjectSlot.tsx` (pickable = ≥ 60% of the box inside stage ∩ viewport; touch: first 8px decide turn vs scroll), `BoothFocus.tsx` (shelf order, scrolls the focused sample into view) | Done |
| Vignette | `Post.tsx`: the vignette uses the cabinet frame's box on home (`vbox`), the stage elsewhere | Done in 6cd5f33; **posters must be re-rendered after it** |
| Posters | `tools/poster-matrix.mjs` (single list), `make-posters.mjs` (cabinet poster stitched to its full frame; shelf posters rendered whole at 393x1400 / 1032x1700), `check-poster.mjs` (compares at a 480px analysis width, checks the pick), `poster-hash.mjs` (gate) | Tray posters (wide, square, phone, tablet × 9) rendered and valid. **Home posters need one more render** (step 2) |
| Tests written | `tools/check-shape.mjs`, `tools/check-shapes.mjs` (the L7 matrix: shape, layout, size floors, framing, overlap, sideways scroll, panel vs labels while scrolling, picking), resize/rotation in `check-smear.mjs` and `check-flicker.mjs` (`ONLY=resize`), tall/square sizes in `check-pill.mjs` (`PILL_SIZES=`), `tools/shots-09b.mjs` (L8 screenshots) | Written |
| Docs | `PROJECT-CONTEXT.md` (header, staging/shots rows, new "Layout by shape (09B)" section), `DELIVERY-09B.md` (draft with `SUITE:` placeholders) | Partly done |

### Verified results so far (software rendering, SwiftShader)
- **check-shape:** PASS everything (see above).
- **check-shapes (the L7 matrix), all 20 viewports PASS** (run before the last two lens/vignette commits; layouts and sizes are unaffected by those):

| Viewport | Shape | Arrangement | Columns | Shelves | Smallest sample (of the frame) |
|---|---|---|---|---|---|
| 390x664 | tall | shelf2 | 2 | 5 | house-of-hex 17.7% |
| 393x659 | tall | shelf2 | 2 | 5 | house-of-hex 17.7% |
| 393x852 | tall | shelf2 | 2 | 5 | house-of-hex 17.7% |
| 430x932 | tall | shelf2 | 2 | 5 | house-of-hex 17.7% |
| 750x393 | phone-landscape | wide | - | - | house-of-hex 10.5% |
| 932x430 | phone-landscape | wide | - | - | house-of-hex 10.5% |
| 768x1024 | tall | shelf3 | 3 | 4 | house-of-hex 15.7% |
| 820x1180 | tall | shelf3 | 3 | 4 | house-of-hex 15.7% |
| 1032x1230 | tall | shelf3 | 3 | 4 | house-of-hex 15.7% |
| 1032x1260 | tall | shelf3 | 3 | 4 | house-of-hex 15.7% |
| 1376x940 | wide | wide | - | - | house-of-hex 10.5% |
| 1376x980 | wide | wide | - | - | house-of-hex 10.5% |
| 1180x820 | wide | wide | - | - | house-of-hex 10.5% |
| 1024x1366 | tall | shelf3 | 3 | 4 | house-of-hex 15.7% |
| 1440x900 | wide | wide | - | - | house-of-hex 10.5% |
| 1568x980 | wide | wide | - | - | house-of-hex 10.4% |
| 1920x1080 | wide | wide | - | - | house-of-hex 10.4% |
| 2560x1440 | wide | wide | - | - | house-of-hex 10.4% |
| 1180x1000 | square | shelf4 | 4 | 3 | house-of-hex 12.2% |
| 1024x1000 | square | shelf4 | 4 | 3 | house-of-hex 12.2% |

(Wide floors are the 09A cabinet's own: 11%, or 9% on a raised plinth with nothing in front.)
- **Tray posters:** all 36 within 0.24% to 0.54% of the live header (limit 2.5%). An earlier run's "FAIL" lines were a test bug (it read the picked poster after the page removed it); fixed in check-poster.
- **Home posters, last run (before the vignette fix):** 12 of 14 PASS (shelf2 1.37 / 2.11%, shelf3 at 1032 1.61%, shelf4 1.66%, cabinet at 1568 0.92%, every first-visit dark poster ≤ 1.2%). The two FAILs were cabinet at 1376x940 (3.99%: the vignette was sized to the whole stage, now fixed in 6cd5f33) and shelf3 at 820x1180 (13.7%: the poster was shorter than the visible shelf; now rendered whole). **Unverified until step 2 and 3 run.**
- Not yet run on 09B code: check-flicker (incl. resize), check-smear, check-pill, check-views, check-layout, check-sizes, check-picking, check-overflow, check-houselights, check-lamp, check-switch, check-redirects, check-sound, check-07, check-targets, check-axe, check-about, transfer-sizes, metrics.

### Decisions taken in 09B that Vish should know (put these in DELIVERY-09B.md; most are already there)
1. **Square shape gets a 4-column, 3-tier shelf, not a taller cabinet.** The room is frozen; a taller cabinet would be new room geometry plus a new lightmap bake. Cropping the cabinet into a narrow window drops the phone under 12%. One line to change back: `layoutKeyFor` in `staging.ts`.
2. **Wide: the band rule (≤ 3% side bands) makes the cabinet run past the first screen on desktops too** (it is the same shape as the iPad landscape). The lamp panel docks at the bottom of the window until its place under the cabinet scrolls in (`html[data-shape='wide'] .panel-slot { position: sticky }`), and DOM sample tags under it hide. To restore the 09A desktop look, remove the band-rule line in `BoothFrame.tsx` (`if (s === 'wide' && (vw - w) / 2 > 0.03 * vw) ...`).
3. **Project pages on tall and square screens** use the gathered cabinet (`square` arrangement, `phoneStaging.ts`) behind the tray, so a route change between the shelf and a project is a layout switch (the canvas fades in on its first full frame).
4. **No PHONE_K on the shelf:** true relative scale everywhere; the bays are sized so the smallest object holds the floor.
5. **The shelf lens** is anchored to the page layout (frame top + 0.42 × frame width), not the screen centre: toolbars showing or hiding change nothing in the picture, and the first screen is the same at every size (this is what makes one poster per shelf possible).
6. **The panel on the tall shelf** (floating pill/rail) steps away whenever it would sit on a label; at the top of the page on a phone it is often away until the visitor scrolls. That is the spec ("never covers a label").

## 4. What is left, step by step

Environment notes for any machine: Node 22; Playwright with Chromium (pass `PLAYWRIGHT=<path to the playwright package>` to the tools if it is not resolvable; do not run `playwright install` in the Claude container, you may need it on yours). The tools assume a production server on port 3100. Without a GPU (SwiftShader) everything is slow: a page load is 1 to 6 minutes at large sizes. With a real GPU it is much faster.

```bash
git clone https://github.com/vishhhh999/portfolio-website && cd portfolio-website
git checkout claude/quirky-knuth-70j1df
npm ci
```

**Step 1. Build and serve (no gate yet, the posters are stale):**
```bash
npx next build
npx next start -p 3100 &
```

**Step 2. Re-render the home posters once (the last commit changed the first frame):**
```bash
ONLY_HOME=cabinet,shelf4,shelf2,shelf3 HOME_ONLY=1 node tools/make-posters.mjs
node tools/poster-hash.mjs --check        # must print ✓
```
(`ONLY_HOME` limits the home posters, `HOME_ONLY=1` skips the 36 tray posters, which are valid; the site share card is redone with the cabinet. A full `node tools/make-posters.mjs` also works, it just takes longer.) Then rebuild with the gate and restart:
```bash
npm run build          # runs the poster gate
kill <the next start pid>; npx next start -p 3100 &
```
Commit `public/` ("Home posters re-rendered after the vignette fix") and push. The Vercel preview should go green.

**Step 3. Poster check:**
```bash
node tools/check-poster.mjs        # every home and tray poster; ONLY_HOME=... or TRAY=slug to narrow
```
Expect all PASS. If one fails, look at it before changing thresholds: the comparison is at a 480px analysis width, so a real failure means the poster and the live booth differ in layout or framing.

**Step 4. The suite (each tool prints PASS/FAIL and exits non-zero on failure):**
```bash
for t in check-flicker check-smear check-pill check-shapes check-shape check-views check-layout check-sizes check-picking \
         check-overflow check-houselights check-lamp check-switch check-redirects check-sound check-07 check-targets check-axe check-about; do
  echo "=== $t"; node tools/$t.mjs; echo "EXIT $t $?"
done 2>&1 | tee suite.log
```
- `check-flicker` includes `resize` (window drag across every shape and the iPad rotation); `ONLY=resize node tools/check-flicker.mjs` runs just that.
- `check-smear` includes the shelf scrolled and the resize/rotation sequence (`SKIP_SHAPES=1` skips it).
- Several older tools (check-layout, check-sizes, check-picking, check-views) still use their 09A viewport lists; check-shapes covers the L7 matrix for layout, sizes, picking and overflow. If an older tool fails because it assumes the 09A phone cabinet (a 4:5 box, the swipe bar, `PHONE_LAYOUT`), update the tool to the shape system (the phone now gets the shelf), do not change the site back.
- Known software-rendering artefact: scroll events and timers are held back for seconds while SwiftShader renders. check-pill and check-shapes already wait for the scroll event; do the same in any tool that measures right after a scroll.

**Step 5. Screenshots and budgets:**
```bash
node tools/shots-09b.mjs           # → tools/lamp-review/09b/shots/ (every L7 size of /, plus /work/sook and /about at 4 sizes)
node tools/transfer-sizes.mjs      # phone project page before scroll must stay ≤ 1.5MB
node tools/metrics.mjs             # JS before 3D ≤ 200KB gz, lazy 3D ≤ 460–480KB gz (09A: 183.7 / 433.9)
```

**Step 6. Finish the docs:**
- `DELIVERY-09B.md`: replace every `SUITE:` placeholder (`switching`, `checks`, `matrix` = the table above, `budgets`, `notdone`) with results. Say plainly what was software-only.
- `HANDOVER.md`: a "09B update" section at the top (what changed, the shelf not locked yet, the decisions in section 3, new tools, how to re-render posters).
- `PROJECT-CONTEXT.md`: already has the 09B architecture; add the new tools to section 9 (Testing), the budgets to section 8, and a history line in section 10.
- No em dashes anywhere.

**Step 7. Deliver and merge:**
- Zip for Vish: `tools/lamp-review/09b/shots/`, the posters (`public/booth/poster-*.webp`), `DELIVERY-09B.md`.
- Update PR #8's body (summary + checks), mark it ready for review, wait for the Vercel preview to be green on the final commit, **squash-merge into main**, report the merge commit hash.
- Do not start any new batch.

**RTX / device commands for Vish (put in DELIVERY-09B §6):**
- RTX 4070 SUPER, Chrome, 2560x1440: open the preview with `/?perf`; in the console `__boothPasses(30)` (still) and `__boothPasses(30, true)` (moving). Targets p50 ≤ 8ms, p95 ≤ 11ms. Then drag the window to a tall shape and back (the switch must not stutter).
- iPhone 15 (Safari): `/?perf`, scroll the shelf top to bottom; the readout's fps must stay ≥ 50 while scrolling. If not, the mobile tier steps the resolution down on its own (`PerfProbe`); report the readout.
- iPad Pro 13: `/?perf` in portrait (3-column shelf) and landscape (cabinet); rotate both ways.

## 5. Pitfalls learned in this session

- **`pkill -f <pattern>` kills your own shell** when the pattern appears in your command line. Kill by PID (`ps -eo pid,args | grep ... | awk '{print $1}' | xargs kill`).
- `process.env.HOME` is the shell's home directory: never use `HOME` as a tool option name (make-posters uses `ONLY_HOME` and `HOME_ONLY`).
- The poster gate (`npm run build` → `tools/poster-hash.mjs --check`) hashes every input of the first frame (staging, shelf, shots, CameraRig, Post, LampRig, BoothFrame, AO maps, models, lightmap, lib/shape). Any change to those needs a poster render before `npm run build` passes. Use `npx next build` (no gate) while iterating.
- Restart `next start` after writing posters or models (it serves `public/` as built).
- The shelf's poster is the WHOLE shelf (rendered in a tall window), the cabinet's poster is its whole frame (stitched from two captures when it runs past the first screen). The page shows the shelf poster at its natural height inside the frame.
- `?shape=wide|square|tall|phone-landscape` forces a shape for testing; `?perf` shows shape, aspect and columns.
- React hydration: the server always renders the `wide` default; anything shape-dependent in DOM is CSS on `<html data-shape data-columns data-layout data-poster>` (set before first paint) or runs after mount.
- The shelf geometry is outside the frozen room file. The room itself must not change.

## 6. Key files for 09B (read these first)
`lib/shape.ts` · `components/booth/staging.ts` · `components/booth/shelf.ts` · `components/booth/ShelfUnit.tsx` · `components/booth/shots.ts` · `components/booth/CameraRig.tsx` · `components/booth/BoothCanvas.tsx` (LayoutGate, size probe) · `components/booth/BoothFrame.tsx` · `components/booth/BoothHost.tsx` · `components/booth/BoothRoom.tsx` · `components/booth/LampRig.tsx` · `components/booth/ObjectSlot.tsx` · `components/booth/Post.tsx` · `components/ui/SwitchPanel.tsx` · `app/globals.css` (last section) · `tools/poster-matrix.mjs` · `tools/make-posters.mjs` · `tools/check-poster.mjs` · `tools/check-shapes.mjs` · `tools/check-shape.mjs` · `tools/bake-shelf.mjs` · `tools/shots-09b.mjs`.
