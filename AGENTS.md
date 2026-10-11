# The Booth: working rules

- Owner: Vishesh Mahendru, a brand and visual designer. He judges by looking. Report visible outcomes, before and after screenshots, numbers and decisions in plain words. No logs. Never claim a check or a measurement that did not run.
- Read `BRIEF.md` (concept, sections 1 to 4, 9, 10) and `PROJECT-CONTEXT.md` before a task. Old handoffs live in `docs/history/` and do not bind you.
- Work on `main` unless told otherwise. Commit per step, named by the visible effect. Push only when `npm run build` and `npm run verify` pass and the step's screenshots look right.
- Never change DNS. The domain cutover is Vishesh's job (`LAUNCH.md`).

## Locked rules

- No distortion of images or type, anywhere. No warps, RGB split or wobble.
- Never invent facts. Copy, years, roles and clients come from `content/`. Do not edit facts in `content/work/corrections.ts`.
- No em dashes in files, copy, comments or commits.
- The lamp never switches by itself. Case-study images are never relit; only the booth changes.
- House lights is a mode of the page, never a page. Content lives in the DOM; the canvas is `aria-hidden`.

## How the booth works (short)

- `components/booth/`: `Booth.tsx` (the layer, the home frame, the project header, the links over the objects), `BoothCanvas.tsx` (demand rendering, scissored views, camera moves, adaptive DPR), `Rig.tsx` (all seven lamps on one fixed light set), `Room.tsx`, `Specimen.tsx` (one object), `composition.ts` (layouts and display scales), `camera.ts`, `materials.ts`.
- The canvas draws only when something moves (`kick(ms)` in `activity.ts`) and never while off screen.
- Lamp looks live in `lib/lampPresets.ts`. Every lamp uses the same lights, so a lamp change never recompiles a shader. Keep it that way.

## Checks

- `npm run build`: routes, audio probe, Next build.
- `npm run verify`: types, routes, redirects, console errors on every route, axe on four pages, and `tools/shots.mjs` into `review/latest`. Needs a production server on port 3100 (it starts one if none is running). `SHOTS=0` skips the screenshots.
- `node tools/weight.mjs`: first-visit bytes, requests, LCP, time to booth ready.
- `GL=gpu node tools/gpu-smoke.mjs`: real frame times. Refuses software WebGL.

## Posters

- The first frame of each booth view is a poster in `public/booth/` (home and each project, wide and tall). Render them after any change to composition, lights, materials or camera: `node tools/make-posters.mjs` (`ONLY=home,sonde` to narrow, `SCALE=2` on a GPU). Restart `next start` afterwards so it serves the new files.

## Environment

- The cloud container uses software WebGL (SwiftShader): slow, fine for screenshots at device scale 1, useless for frame times. Real numbers come from Vishesh's PC with `GL=gpu`.
- Never run `pkill -f` with a pattern in your own shell. Kill the `next-server` PID instead.
- Models: `node tools/optimize-models.mjs [slug]` writes `public/models/` from `assets-src/models/` (WebP textures, meshopt; no KTX2).

## Run on Vishesh's PC

```bash
git pull
npm ci
npm run build
npx next start -p 3100
# in a second Git Bash or WSL terminal:
GL=gpu node tools/gpu-smoke.mjs
GL=gpu node tools/make-posters.mjs
```

In PowerShell use `$env:GL='gpu'; node tools/gpu-smoke.mjs`. Desktop phone emulation is not an iPhone measurement.
