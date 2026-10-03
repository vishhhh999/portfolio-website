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

## Status

Phases 0–2 done (scaffold, booth + house lights, all seven lamps). Next up: Phase 3, UV + SCREEN + AFTER DARK polish (the systems already run; Phase 3 is quality).
