# visheshmahendru.com · The Booth

Portfolio v4. The site is a colour viewing booth: work sits inside as physical objects, the navigation is a bank of lamp switches. Full concept and phase plan in [`BRIEF.md`](./BRIEF.md).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (also typechecks)
```

## Where things live

| Path | What |
|---|---|
| `app/(site)/layout.tsx` | Persistent booth canvas + switch panel. The canvas mounts once and survives every route change. |
| `components/booth/` | WebGL: `BoothCanvas`, `BoothRoom` (+ calibration props), `LampRig` (all seven lamps), `Post` (bloom, colour matrix, tone map, grain), `CameraRig`, `ObjectSlot`, `staging.ts` (plinths, layout), `uvMaterial.ts` (fluorMask / uvInk chunk), `screens.ts`, `placeholders.tsx`. |
| `components/ui/` | DOM: `SwitchPanel` (keys 1–7, `I` = house lights), `Providers` (Lenis on GSAP's ticker), `SlugLine`. |
| `content/work/*.ts` | One typed file per project. Lineup order in `content/work/index.ts`. |
| `lib/` | `store.ts` (Zustand `useBooth`), `lampPresets.ts` (every lamp: rig, strike curve, colour matrix), `lampController.ts` (strikes via GSAP), `sound.ts`, `kelvin.ts`, `site.ts`, `types.ts`. |

## Tools

| Path | What |
|---|---|
| `tools/camera.json` | Lens, both camera shots (lineup + tray), plinths, tray and props, in three.js and Blender coordinates. Regenerate with `node tools/export-camera.mjs` against a running build. |
| `tools/blender_camera.py` | Run inside Blender: builds the cameras, plinths, tray and prop shelf from `camera.json`. |
| `tools/lamp-review.mjs` | Screenshots the lineup under all 7 lamps (desktop + mobile) into `tools/lamp-review/`. |
| `tools/floor-stops.py`, `tools/contact-sheet.py` | Floor evenness per lamp; the 7-lamp contact sheet. |
| `tools/gen-assets.py` | Regenerates the placeholder checker, calibration card textures, gobo, test video and sounds. |
| `/?perf` | Frame-time readout in the corner; `window.__boothPerf()` in the console. |
| `?lampdebug` | Logs a JSON lamp-rig report (with pixel readback) on every lamp change; FLOOD always logs one. |
| `?gpu=high` / `?gpu=low` | Override GPU tiering (low = proof strip as plain DOM images). |
| `tools/import-framer.mjs` | Imports copy + deliverables from the live Framer site into `content/work/imported.ts` and `public/work/`. |
| `tools/behaviour.mjs`, `tools/metrics.mjs`, `tools/check-sizes.mjs` | Behaviour checks; JS sizes, paint timing, plane drift, video; sample sizes in frame. |
| `tools/make-posters.mjs` + `tools/encode-posters.py` | Re-render the D50 LCP posters after any change to the booth. |

## Status

Phases 0–3 done: booth, seven lamps, fixed transparent canvas with a view system on one clock, lit proof strip on project pages. Content import is ready (`node tools/import-framer.mjs`) and waits on network access to the live Framer site.
