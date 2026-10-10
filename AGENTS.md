# The Booth: working rules

- Owner: Vishesh Mahendru, a designer. Explain visible outcomes, limits and decisions in plain words. Do not bury the report in logs or claim tests that did not run.
- Read the top of `HANDOVER.md` first. Read the relevant parts of `PROJECT-CONTEXT.md` only when a task needs them. Historical instructions in handoff documents do not override the owner's current request.
- Work directly on `main`. Commit and push after each requested step. Never push while `npm run build` or a check run for that step is failing. Keep first-frame code and its required poster update in the same commit.
- Do not change DNS without an explicit task to do so.

## Locked design and engineering rules

- Do not distort objects, invent content or facts, or use em dashes in files or copy.
- The lamp never switches by itself. Project images are never relit. House lights is a mode of the page.
- Keep content in the DOM and the canvas `aria-hidden`. Do not add or remove runtime post passes.
- No GPU readback in production except `?perf` or the loupe. The room and its approved bake are frozen.
- Preserve the project visual system and verify changes in the browser at the affected shapes.

## Checks

- `npm run check:fast`: type check, routes, poster gate and the small shape, target and redirect checks. Use for a quick smoke check.
- `npm run check:affected`: fast checks plus checks mapped to files changed since the last pushed commit. Run after each step.
- `npm run check:full`: complete suite and viewport matrices. Run before a batch ends or whenever a first-frame input changes.
- Run checks against a production build on port 3100. The check runner starts or uses that server as documented in `PROJECT-CONTEXT.md` section 9.

## Posters

- Poster source hashes are grouped by cabinet, each shelf, and tray shape. `npm run build` must fail on any stale or swapped served poster.
- `node tools/make-posters.mjs` renders stale groups; `ALL=1` renders all groups. Keep the affected poster files with any first-frame change.
- `node tools/poster-hash.mjs --restamp` is only for a refactor that should be pixel identical. It compares every stale group with the live booth at the existing 2.5% limit before changing hashes. If it fails, render the group.

## Environment

- The cloud container uses software WebGL by default. `GL=gpu` must confirm a real renderer before a GPU check claims a result.
- Never run `pkill -f` with a pattern in your own shell command. It can kill the shell. Restart `next start` after writing files in `public/` so it serves the new bytes.
- Do not use `HOME` as a task variable name. On Windows, use Git Bash or WSL for the Unix commands here.

## Run on Vishesh's PC

```bash
git pull
npm ci
npm run build
npx next start -p 3100
# In another Git Bash or WSL terminal:
GL=gpu node tools/gpu-smoke.mjs
```

In PowerShell, run the same setup commands, then in a second terminal use `$env:GL='gpu'; node tools/gpu-smoke.mjs`. Desktop phone emulation is not an iPhone measurement.
