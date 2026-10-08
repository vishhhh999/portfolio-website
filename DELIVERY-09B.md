# Delivery report: batch 09B (responsive system by screen shape)

PR: https://github.com/vishhhh999/portfolio-website/pull/8 · branch `claude/quirky-knuth-70j1df` · preview: https://portfolio-website-git-claude-quir-6d3869-vishafterdark-projects.vercel.app (Vercel login).
This batch is the layout by screen shape and the shelf, nothing else.

**Everything below was verified in software rendering (SwiftShader, no GPU).** Shapes, sizes, framing, overlaps, picking and stale pixels are exact. Anything in milliseconds or fps is not measurable here: the RTX and iPhone / iPad numbers are yours to take (section 6).

## 1. What each shape gets

The shape is measured the way the browser presents the page: visual viewport width over the **small** viewport height (toolbars shown), so a collapsing toolbar never changes it. Thresholds 0.88 and 1.3 with a ±0.04 band, so a window dragged across a threshold changes the layout once, not back and forth. Recomputed on resize and rotation (150ms debounce, only on a change over 2%). `?shape=wide|square|tall|phone-landscape` forces one; the `?perf` readout shows shape, aspect and columns.

| Shape | Aspect | Home | Project header |
|---|---|---|---|
| wide | ≥ 1.3 | the 09A cabinet, as wide as the content (side bands ≤ 3% of the window). The lamp panel docks at the bottom of the window until its place under the cabinet scrolls in | as 09A |
| phone-landscape | wide, svh height < 480 | the cabinet in the full height; the headline moves into the masthead row; the lamp panel is a slim rail along the bottom; nothing cropped | as 09A |
| square | 0.88 to 1.3 | **the shelf, 4 columns × 3 tiers**, whole on the first screen (see note) | the gathered cabinet behind the tray |
| tall | < 0.88 | **the shelf**, 2 columns under 600px (5 shelves), 3 columns from 600px (4 shelves), taller than the screen, scrolled with the page | the gathered cabinet behind the tray, a taller header on phones |

**Note on square:** the brief asks for "a taller cabinet with three tiers". The room is frozen (`booth-room.glb`, its lightmap), so a taller cabinet would be new room geometry plus a new bake. The only way to make the cabinet "taller" without that is cropping it into a narrow window, and then the phone stays under 12% of the frame. So the square shape gets the same shelf system with 4 columns and 3 tiers: whole, nothing cropped, every sample ≥ 12% of the frame. If you would rather see the cropped cabinet there, it is one line (`layoutKeyFor` in `staging.ts`).

## 2. The shelf

- A wall shelving unit in the booth's own materials: N8 sides and back panel, N8.5 boards (the plinths' grey), the kick in the lip's N6.5, the same lamps. Under every sample, on its board's front edge, an engraved mono label rail with the project's name. The About certificate has its own slot. The tug stands on a low plinth with its 1:24 plate. The JSW book stands closed.
- New geometry in code (`components/booth/shelf.ts`), outside the frozen room file, with its own uv1 atlas and its own AO bake (`tools/bake-shelf.mjs` → `public/booth/ao-shelf{2,3,4}.png`). **Not locked yet:** once you approve it, `SHELF_LOCK=1 node --experimental-strip-types tools/bake-shelf.mjs` records its hash in `tools/booth-shelf.lock`.
- True relative scale everywhere (K = 1, the tug 1:24): no PHONE_K was needed. The bays are only as wide as the pieces need (46cm on 2 columns; 34cm on 3 with SHUNYA and the JSW book in double bays; 33cm on 4).
- Upright pieces (pouch, phone, book, tablet) stand on the top rows, which are seen from a little below; the flat ones (laptop, SHUNYA, the Bengal wedge, the tug) sit lower.
- **Scrolling:** the page scrolls normally (Lenis as it was, nothing hijacked). The camera is locked to the page: the shelf's front edges move exactly with the page, deeper things a touch less, so the camera travels down the shelf. Under reduced motion: a fixed camera pose per shelf, the picture moves as plain scroll.
- **Touch:** tap opens; a sideways drag turns the sample (the first 8px decide: mostly sideways turns it, anything else scrolls). The lamp panel floats (the bottom rail on phones, the pill on tablets) and steps away whenever it would sit on a label or on the sample under your finger.
- **Keyboard and screen readers:** ↑ ↓ move through the samples in shelf order (the page scrolls the sample into view), Enter opens, ← → turn; the focusable list is in shelf order.
- **Lighting:** the panel lamp becomes a softbox above and in front of the unit, the key stands back above it, aimed at its middle, at a level corrected for the longer throw. There is no room environment capture on the shelf (it uses the cabinet's capture, or the built interior).

## 3. Live switching

Staging, camera, AO map and the poster are chosen by shape at runtime; `PHONE_LAYOUT` (chosen once at load) is gone. On a shape change the frame on screen is held over the canvas (copied once, on the GPU, into a 2D canvas: no CPU readback, no pass added or removed), the new arrangement is applied (shared models and textures; only transforms, bases, camera and AO change; the lamp kept, hover cleared, picking rebuilt, turns kept), its shaders are compiled and its AO map is in, one full frame is drawn under the cover, then a 250ms crossfade (instant under reduced motion). The first load already picks the right poster for the shape (the pre-paint script).

SUITE:switching

## 4. Checks

SUITE:checks

## 5. The L7 matrix

SUITE:matrix

## 6. Budgets and what to measure on real devices

SUITE:budgets

## 7. What to test by hand

1. **iPhone 15, Safari:** scroll the shelf top to bottom (smooth, no jumps, labels stay sharp); turn a sample with a sideways drag without the page scrolling; a vertical swipe that starts on a sample must scroll; tap to open; the lamp rail never sits on a label.
2. **iPad Pro 13, Safari:** portrait (3 columns), rotate to landscape (the cabinet) and back, twice; nothing should flash or jump, and there must be no sideways scroll.
3. **Desktop, Chrome:** drag the window edge slowly across the wide / square line (aspect 1.3) and the square / tall line (0.88), both ways. The layout should change once at each line, not flicker back and forth.
4. **Phone held sideways:** the headline in the masthead row, the cabinet whole, the rail along the bottom.

## 8. Not done, and why

SUITE:notdone
