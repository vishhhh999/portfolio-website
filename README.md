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
| `components/booth/` | WebGL: `BoothCanvas`, `BoothRoom`, `CameraRig`, `ObjectSlot`, `placeholders.tsx` (Phase 0 stand-ins at real scale). |
| `components/ui/` | DOM: `SwitchPanel` (keys 1–7, `I` = house lights), `Providers` (Lenis on GSAP's ticker), `SlugLine`. |
| `content/work/*.ts` | One typed file per project. Lineup order in `content/work/index.ts`. |
| `lib/` | `store.ts` (Zustand `useBooth`), `lampPresets.ts`, `kelvin.ts`, `types.ts`. |

## Status

Phase 0 (scaffold) and Phase 1 (booth + D50 + house lights) done. Next up: Phase 2, all seven lamps.
