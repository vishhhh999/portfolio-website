# Batch 10: faster checks and cleanup

## Delivered

- Working rules are in `AGENTS.md`. Graphics tools share one browser launcher. Software rendering remains the cloud default; `GL=gpu` verifies the renderer and refuses a software fallback.
- Poster integrity is split into eight groups. The build still rejects stale source hashes or changed poster and share-card bytes. The poster renderer selects stale groups by default, with `ALL=1` for a complete run and `JOBS` for parallel groups.
- `check:fast`, `check:affected` and `check:full` are available. The runner writes `suite.log` with each check's time. `check:full` uses the complete viewport matrices. Routine checks use a smaller representative set without removing assertions.
- `check-console` checks all 12 public routes at desktop and phone sizes with an empty error allowlist. It found no 404 or browser error in the current production build, including direct project visits. The historical 404 could not be reproduced, so no asset was changed without evidence.
- The two KTX2 loader instances were consolidated in a local refactor, but the required pixel-identical restamp completed only 6 of 56 comparisons in about nine minutes on SwiftShader. The refactor was reverted under the section time box. The original loader warning remains.
- The About caption is `Specimen · black and white` in the shared About page, including house-lights mode. The image alt text remains `Portrait of Vishesh Mahendru`, which describes the photograph. The photo was not changed.
- `gpu-smoke` is ready for a PC with Chrome and a real GPU. It refuses software rendering and writes a compact result table when run on hardware. No hardware result was generated here.

## Timing evidence

The first full software-rendered suite run was stopped under the section time box. Six checks finished: routes 0.1s, poster hash 0.1s, TypeScript 2.3s, redirects 0.2s, shape classification 34.8s, and targets 183.8s. At stop, poster comparison had run for more than 24m51s, flicker more than 24m18s, and smear more than 21m49s. Their exact before and after full-suite times are unavailable. Their routine passes now use fewer viewports or shorter resize sequences; `SIZES=all` in `check:full` retains the complete matrices.

| Check | First fast run | Latest fast run |
| --- | ---: | ---: |
| TypeScript | 2.6s | 2.7s |
| Routes | 0.0s | 0.0s |
| Poster hash | 0.1s | 0.1s |
| Shape classification | 27.7s | 30.1s |
| Targets | 71.8s | 81.6s |
| Redirects | 0.3s | 0.5s |
| Total, concurrent | 72.0s | 81.7s |

Typical small edits should reach the fast verdict in about 1 to 2 minutes in this cloud, then take only the mapped checks. The measured affected tier with the new console check took 129.5 seconds. Content or graphics changes can take longer. A complete graphics suite has not been certified in this batch.

## Poster dependency proof

Each temporary byte change was reverted after checking the stale-group list.

| Changed input | Stale groups |
| --- | --- |
| `shelf.ts` | shelf2, shelf3, shelf4 |
| `public/booth/ao.png` | cabinet, tray-wide |
| `Post.tsx` | all eight |
| `staging.ts` | all eight |

`staging.ts` is shared by the cabinet and trays, so it cannot safely be marked cabinet-only. A shelf-only change requires three groups instead of all 63 files.

## Run this on Vishesh's PC

In Git Bash or WSL, run `git pull`, `npm ci`, `npm run build`, then `npx next start -p 3100`. In another terminal run `GL=gpu node tools/gpu-smoke.mjs`. In PowerShell, use the same setup commands and run `$env:GL='gpu'; node tools/gpu-smoke.mjs` in the second terminal. The command records still and moving frame times and shelf scroll fps in `gpu-smoke.md`. Phone emulation on a desktop GPU is not an iPhone measurement.

Vishesh still needs to run this on the RTX 4070 SUPER, test the shelf on his iPhone 15 and iPad Pro 13, approve the shelf before `SHELF_LOCK=1 node --experimental-strip-types tools/bake-shelf.mjs`, choose a headline font with `?type=a|b|c`, turn on Vercel Analytics, and handle the domain cutover described in `LAUNCH.md`.

## Delivery status

09B was merged with history at `7eaea61`. Batch 10 uses direct commits on `main`, so it has no new merge commit. All browser checks reported here used software rendering. No real GPU performance result was produced in this cloud.

Completed main commits: `41fd5d6` working rules, `5601f8c` browser launcher, `844f977` poster groups, `7083cbb` check runner, `3d4a2b9` console guard, and `fdd9f2f` GPU smoke command. The cloud environment startup instructions were saved as a review draft; they are not published yet.

Vercel reported a successful production deployment for `fdd9f2f` at `https://portfolio-website-gh6p5l6lu-vishafterdark-projects.vercel.app`. The final report-only push receives its own deployment; its URL and status must be checked after that push.
