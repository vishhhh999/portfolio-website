# THE BOOTH
### visheshmahendru.com v4: concept + build brief for Claude Code

Paste this whole file into the repo as `BRIEF.md` and tell Claude Code: "Read BRIEF.md and execute Phase 0, then stop for review." Then go phase by phase.

---

## 1. Why the current site failed

The feedback was right. A monochrome work grid with a Switzer headline and a project list is the default output of every Framer template. Nothing on it could only belong to you. Swap the name and it's anyone's site.

The fix is not "more animation". The fix is one idea that is unmistakably yours, that a recruiter can describe in one sentence after closing the tab, and that proves your actual skills (brand, packaging, print, web, 3D lighting) instead of decorating them.

Rule from the best portfolios: the signature idea must be describable in one sentence. Bruno Simon is "the one where you drive a truck". Yours will be:

> **"The one where you flip the lights and watch his work hold up under each one."**

---

## 2. The concept

### The insight
Your positioning line is "brand and digital design that holds up wherever it's seen". Every packaging and print designer knows the physical object that tests exactly that claim: the **colour viewing booth**. A grey box with switchable standard lamps (D50 daylight, TL84 store light, Illuminant A home light, UV) used to check whether colour survives a change in light, and to catch metamerism. Under UV it reveals hidden optical brighteners in paper.

So the whole site **is a viewing booth**, rendered in real-time WebGL. Your work sits inside it as physical objects. The navigation is a panel of physical lamp switches. Each switch relights every object, physically, in real time.

Your positioning stops being a sentence and becomes an interaction you can verify yourself.

### Why this is "very you" and nobody else's
- It comes from print and packaging production, your actual depth. Most portfolio devs have never seen a light booth. Every brand/packaging person who visits instantly gets it.
- It turns your 3D skill into infrastructure, not the headline. You are positioning as brand + web first, 3D supporting. Here 3D is the medium the brand work is proven in, exactly the hierarchy you want.
- Lighting and composition are your 3D strengths (you're a generalist, not a hard-surface modeler). This concept is 90% lighting and staging, 10% simple objects you already have in Blender.
- Your handle is **vishafterdark**. The last lamp on the panel is AFTER DARK. It closes the loop on your whole identity.

### The lamps (the entire navigation system)

| Switch | Real basis | What happens in the booth | Native to |
|---|---|---|---|
| **D50 · DAYLIGHT** | 5000K print-proof standard | Soft top rect light, neutral, the "truth" state. Default on load. | JSW Sports book |
| **TL84 · STORE** | Retail fluorescent | Cooler, narrow-band green spike (colour matrix lowers red saturation), faint 100Hz flicker on strike, ballast hum | Too Yumm, SOOK |
| **A · HOME** | 2856K tungsten | Warm, low, intimate, long soft shadows | SHUNYA |
| **UV · BLACKLIGHT** | UV-A | Booth goes dark violet. Paper whites fluoresce. **Hidden annotations appear printed on the work in "invisible ink"** (see 2.1) | All |
| **FLOOD** | Stadium floodlight (custom) | Hard high key from above, volumetric haze cone, deep shadows | Bengal T20 League |
| **SCREEN** | No lamps (custom) | Every lamp off. The only light comes from the devices' own screens spilling onto the booth floor | Mitooshi, House of Hex, Indo Thai, Sonde |
| **AFTER DARK** | Your handle (custom) | Total black. Your cursor becomes a hand lamp with a gobo cookie and a little inertia. Finger on mobile, or gyro | All |

Plain cursor-flashlight reveals are a 2019 trend and now a free Framer component, so AFTER DARK is deliberately one lamp out of seven, not the gimmick. It's the encore, not the show.

### 2.1 The killer feature: UV mode reveals your thinking
You keep your portfolio finished-work-only, no process slides. Keep that. But under UV, each object shows 3 to 6 annotations printed on the object itself in fluorescent ink, like a proofer's hidden marks:

- construction grids and alignment lines on the pouch face
- "window sized so the almonds read from 2m shelf distance"
- type specs, cap heights, colour builds (CMYK + Pantone) on the book cover
- on screens: the layout grid and spacing tokens light up over the UI

So the default view is the clean finished object (your principle), and the design reasoning is literally hidden inside it, discoverable by flipping one switch. Recruiters who want to know "can he think, or just make it pretty" get the answer without a single process page. This is the part people will screenshot.

### 2.2 The loader: a metamerism test strip
Two swatches that match perfectly under D50. The lamp strikes and flips to A, and the swatches split into two visibly different colours. Copy: "Same colour. Different light. That's the job." 1.5 seconds, skippable, only on first visit (sessionStorage). It teaches the visitor the concept before they see the site, in a way only a print nerd would design.

### 2.3 The recruiter escape hatch: HOUSE LIGHTS
A separate switch, visually distinct (big rocker, top of panel): **HOUSE LIGHTS ON**. Kills the booth and drops a fast, flat, beautifully typeset index of every project (2D, images, tags, year). Also key `I`. Remember the choice in localStorage, but only a choice the visitor made (rocker or `I`); a first-time visitor always starts with house lights off.

This matters more than any effect. A recruiter with 40 tabs open must get to the work in under 3 seconds. The booth earns attention, the house lights respect time.

---

## 3. Site structure

```
/                 The booth. All hero objects lined up on the booth floor.
/work/[slug]      Booth becomes a sticky header with that object on the tray, under its native lamp. Case content below.
/house-lights     House-lights view (also reachable by switch / key I). SSR, no WebGL.
                  Never name a route segment "index": Vercel serves /index from the root page (tools/check-routes.mjs guards this).
/about            The calibration certificate.
/archive          Secondary. Contact-sheet view (see 3.4).
contact           "Book a viewing" (mailto:work@visheshmahendru.com + email copy), lives in footer and panel.
```

### 3.1 Home: the lineup
- Booth interior, Munsell N7 neutral grey like a real booth (pick a hex in the ~#A8A8A6 range and calibrate by eye), slight paper grain.
- Camera locked, long lens (equivalent ~100mm), level horizon, flat front. No orbit controls. The booth is a stage, not a playground. (Gentle parallax on pointer, max 1.5 degrees.)
- Objects stand in a single row on the floor, proofing-lineup style. Hover one: a small spec plate slides up (name, discipline, year). Click: it slides forward onto the centre tray, the others recede into shadow, route changes to `/work/[slug]`.
- Top-left headline, in DOM over the canvas:
  **Tested under every light.**
  Brand and digital design by Vishesh Mahendru. India, working worldwide.
- Right side: the switch panel. Real rocker switches modelled as DOM buttons styled as hardware (`aria-pressed`, keyboard 1 to 7). Each has a small indicator lamp. The active lamp's colour temperature is shown in mono: `5000K`, `TL84`, `2856K`, `UV-A`.

### 3.2 Project page
- Canvas persists across routes (one canvas in the root layout, never remounted). The booth shrinks to a ~70vh sticky header, then scrolls away.
- Object loads under its **native lamp** (table above) so each project is first seen in the light it was designed for. All switches still work.
- Below: a **spec plate** (Client type, Role, Year, Scope, Disciplines) styled like a booth's calibration label, then the 6 deliverables laid out as a **proof strip**: crop marks, registration targets, colour bars in the margins, frame numbers in mono. Your 6-deliverable rule stays.
- Behance link styled as "Full proof set ↗".
- Next project: the next object slides onto the tray. No page flash.

### 3.3 About: the calibration certificate
A one-page "Certificate of Calibration" for Vishesh Mahendru. Certified illuminants: brand identity, packaging, editorial, web, product UI, 3D. Instrument history (experience) as calibration log entries with dates. Gold WOW Awards Asia listed as a test result. Signature + stamp. Portrait photo shot under real D50 if you have one (lit like the objects).

### 3.4 Archive: contact sheet
The archive as a lightbox/contact sheet under D50. Images, autoplay videos (click opens player with sound), 3D models open in the booth itself (this solves your "Sketchfab-quality viewer" goal for free: the booth IS the viewer).

### 3.5 Mobile
Switch panel becomes a bottom rail of 7 round lamps. Objects become a horizontal swipe carousel on the tray. AFTER DARK uses finger drag, optional gyro after a tap permission. DPR capped at 1.5. If the device is weak (see 5.3), fall back to pre-rendered images per lamp (you render them in Blender, 7 PNGs per object) and crossfade between them. Same idea, zero WebGL.

---

## 4. Visual system

- **Colour:** booth N7 grey, ink near-black #111, paper #F2F0EA for DOM surfaces. No brand accent colour. The lamps are the colour. Each lamp's indicator uses its own physical colour (D50 neutral white, TL84 greenish white, A amber, UV violet, FLOOD cold white, SCREEN cyan-white, AFTER DARK one red standby dot).
- **Type:** one utilitarian grotesk + a true mono for every label, spec and number. Free default: Geist + Geist Mono. If you want it to feel more expensive later, swap the grotesk for a paid one (ABC Diatype, Söhne) and keep the mono. Headlines big and tight, labels small, all-caps mono, wide tracking. Kill Switzer.
- **Graphic language, from print production:** crop marks, registration targets, colour bars, slug lines (`VM_PROOF_0047 · D50 · 2026-10`), frame numbers. Used as structure, not decoration.
- **Motion:** measured, mechanical. Switches have a click and 80ms indicator delay. Lamps don't fade, they **strike**: fluorescent flicker for TL84, warm ramp for A, instant hard on for FLOOD. Easing: no bouncy springs anywhere. Objects slide on the tray like they're on rails.
- **Sound (off by default, toggle in panel):** rocker click, TL84 ballast hum, faint UV buzz. That's it.

---

## 5. Technical spec (for Claude Code)

### 5.1 Stack
- Next.js (App Router, TypeScript), deployed on Vercel, GitHub repo, custom domain www.visheshmahendru.com (move DNS from Framer only after launch checklist passes).
- three.js via @react-three/fiber + @react-three/drei, pmndrs/postprocessing.
- GSAP for DOM motion and lamp sequencing, Lenis for scroll.
- Content: local MDX or typed JSON per project in `/content/work/*.ts`. No CMS.
- Media: images via `next/image`. Videos and GLBs on Cloudflare R2 (zero egress fees) behind a custom subdomain like `media.visheshmahendru.com`, so Vercel bandwidth never caps your media quality.
- Assets: glTF/GLB compressed with gltf-transform (meshopt + KTX2 textures).

### 5.2 Lighting architecture
- One `useBooth()` Zustand store: `lamp`, `strikeProgress`, `activeSlug`, `houseLights`, `sound`.
- Each lamp is a preset object: light rig (RectAreaLight top panel for D50/TL84/A, SpotLight + volumetric cone mesh for FLOOD, none for SCREEN/AFTER DARK), colour temperature converted from Kelvin to linear RGB, intensity, a 3x3 colour matrix applied in a final post pass (this is what sells TL84's narrow spectrum and A's warmth), shadow softness, fog/haze amount.
- Lamp change = GSAP timeline that animates `strikeProgress` and blends rig A to rig B, with per-lamp strike curves (flicker for TL84 is a noise-driven intensity curve over 400ms).
- **UV mode:** every object material has two extra texture slots authored in Blender: `fluorMask` (which areas fluoresce: paper whites, specific inks) and `uvInk` (the annotation layer, black background, white marks). In UV, base lighting drops to ~3%, ambient tinted violet, `fluorMask * violetWhite` and `uvInk * cyanWhite` go to emissive, bloom catches them. Implement via `onBeforeCompile` on MeshStandardMaterial or a small custom shader chunk.
- **SCREEN:** screen meshes use video textures as emissive; a RectAreaLight sized to each screen, colour driven by the video's average colour sampled every ~10 frames from a tiny downscaled canvas, so the floor spill changes with the UI content.
- **AFTER DARK:** SpotLight attached to a pointer-follow target with critically damped lag, gobo via `spotLight.map` with a torch cookie texture, slight film grain in post.
- Shadows: baked contact shadows (drei AccumulativeShadows or ContactShadows) per lamp where possible. Real-time shadows only for the active key light.

### 5.3 Performance budget (non-negotiable)
- LCP under 2.5s on a mid-range Android over 4G. Headline + switches are DOM and render before WebGL.
- JS budget (revised in Phase 2): **≤200KB gzipped before the 3D loads.** The 3D code (three, R3F, drei, postprocessing, lamp rigs) is always lazy-loaded after first paint and never blocks LCP. (The original "~300KB including three" isn't reachable: three + R3F alone is ~210KB gz.) Lazy-load every GLB after first paint, in viewport order.
- Each GLB under 2MB, textures KTX2, 2K max (4K only for the tray hero object).
- Canvas pauses (`frameloop="demand"`) when nothing animates and when the booth is scrolled out of view.
- GPU tier detection (drei `PerformanceMonitor` / detect-gpu). Low tier → pre-rendered image fallback (5.4). `prefers-reduced-motion` → no strike flicker, no parallax, instant lamp swaps.
- Lighthouse: Performance 85+ mobile, Accessibility 95+, SEO 100.

### 5.4 Fallback image set
For every object, a Blender render per lamp (7 PNG/AVIF). Used for: low-end devices, OG images (one per project under its native lamp), the /house-lights view, and as the LCP image before WebGL boots.

### 5.5 Accessibility + SEO
- All content in the DOM. Canvas is `aria-hidden`, purely presentational.
- Switches are real `<button aria-pressed>`, labelled ("Daylight, D50"), keyboard 1 to 7, `I` for house lights.
- UV annotations also exist as a visually hidden list in the DOM per project, so screen readers and Google read your design reasoning.
- Per-page metadata, OG image per project, sitemap, JSON-LD Person.

### 5.6 Repo layout
```
app/(site)/layout.tsx        persistent <BoothCanvas/> + <SwitchPanel/>
app/(site)/page.tsx          lineup
app/(site)/work/[slug]/page.tsx
app/(site)/house-lights/page.tsx    house lights, no WebGL
app/(site)/about/page.tsx
app/(site)/archive/page.tsx
components/booth/            BoothCanvas, BoothRoom, Tray, ObjectSlot, lamps/*.ts, UVMaterial, ScreenSpill, HandLamp
components/ui/               SwitchPanel, SpecPlate, ProofStrip, CropMarks, SlugLine, Certificate
content/work/*.ts            typed project data incl. lamp, glb, uvNotes[], deliverables[6], fallbacks{}
lib/kelvin.ts, lib/lampPresets.ts, lib/store.ts
public/textures/             gobo, grain, booth
```

### 5.7 Project data shape
```ts
type Lamp = 'D50' | 'TL84' | 'A' | 'UV' | 'FLOOD' | 'SCREEN' | 'AFTERDARK';
type Work = {
  slug: string; title: string; disciplines: string[]; year: number;
  role: string; scope: string; nativeLamp: Lamp;
  glb: string;                       // R2 URL
  fallbacks: Record<Lamp, string>;   // pre-rendered per lamp
  uvNotes: { text: string; anchor: [number, number, number] }[]; // 3 to 6
  deliverables: { type: 'image' | 'video'; src: string; alt: string }[]; // exactly 6
  behance?: string;
};
```

---

## 6. Content map (what sits in the booth)

| Project | Hero object in booth | Native lamp | UV reveals |
|---|---|---|---|
| Too Yumm | Standing pouch (you have the Blender template) | TL84 | pouch grid, window logic, type hierarchy |
| SOOK | Tea box trio | TL84 | colour system, box die-line |
| SHUNYA | Camphor jar + tin | A | label construction, ritual-set system |
| JSW Sports | Coffee table book, standing open | D50 | cover type specs, colour builds, page grid |
| Bengal T20 League | Folded flag + match ticket + jersey swatch stack | FLOOD | logo construction, identity grid |
| Mitooshi | Laptop, ASCII art on screen | SCREEN | layout grid, ASCII system |
| House of Hex | Phone on a small stand | SCREEN | UI spacing tokens, grid |
| Indo Thai | Laptop | SCREEN | layout grid, 3D/web relationship |
| Sonde | Tablet with the product UI | SCREEN | component logic, the violet "where Sonde looks" rule |

Order on the lineup follows your positioning: brand + web pieces centre-stage, packaging-heavy pieces on the flanks.

**What you author in Blender per object** (this is your real workload, Claude Code can't do it):
1. Clean GLB, real-world scale in cm, origin at base centre, applied transforms.
2. Baked AO into the base texture.
3. `fluorMask` texture (white where paper/ink should glow under UV).
4. `uvInk` texture: your annotations, hand-placed on the UV layout. Write them like a production note, short and specific.
5. 7 fallback renders, one per lamp, same camera as the web booth (give Claude Code the camera FOV/position, or have it export a camera JSON you import into Blender).

---

## 7. Build phases (run in Claude Code, review after each)

> **Git workflow.** Until launch, Claude Code commits straight to `main` with descriptive messages (one author, no review overhead). **Before the custom domain is pointed at Vercel (Phase 7), switch to branch → Vercel preview → merge**, so the live site only changes after a preview has been checked.

- **Phase 0: Scaffold.** Next.js + R3F + Lenis + GSAP, persistent canvas in layout, routes, content types, 9 placeholder objects (simple primitives at the right scale), deploy preview on Vercel. Stop.
- **Phase 1: The booth + D50 + house lights.** N7 room, rect top light, camera lock, lineup, hover spec plates, click to tray, routing without canvas remount, /house-lights page. Stop.
- **Phase 2: All seven lamps.** Lamp presets, Kelvin conversion, colour matrix post pass, strike timelines, switch panel with keyboard, sound toggle. Stop.
- **Phase 3: UV + SCREEN + AFTER DARK.** UV material chunk with fluorMask/uvInk, bloom, screen spill lights, hand lamp with gobo. Stop.
- **Phase 4: Real assets.** Swap placeholders for your GLBs one at a time, compress, tune each lamp per object. Stop.
- **Phase 5: Pages.** Project page (spec plate, **lit proof strip per rule 10.1**, crop marks, slug lines), About certificate, Archive contact sheet, metamerism loader. Stop.
- **Phase 6: Mobile + fallbacks + perf.** Bottom rail, swipe tray, GPU tiering (low tier → plain DOM proof strip), image fallbacks, reduced motion, Lighthouse pass, OG images. Stop.
- **Phase 7: Launch.** Sitemap, metadata, analytics (Vercel Analytics), R2 media domain, point www.visheshmahendru.com at Vercel, keep Framer live until DNS propagates.

Instruction to Claude Code for every phase: open the preview in a browser, screenshot desktop and mobile, check it against this brief, fix what's off, then report.

---

## 10. Locked rules (apply to every phase from Phase 3 on)

### 10.1 Lit proof strip (built in Phase 5, project pages)
- The 6 deliverables on each project page render as **WebGL planes inside the existing single persistent canvas**, mirrored to the positions of their DOM images.
- The DOM `<img>` stays in the layout for SEO, accessibility and fallback, and is **visually hidden once its plane is ready**. It is never removed.
- Planes read **the same Lenis scroll value every frame**, so they stay locked to the layout with zero drift. Lenis and the canvas run off **one RAF/ticker**, not two loops.
- Every plane is **lit by the active lamp**: the same presets, strike curves and colour-matrix pass as the booth. Switching lamps relights the photographs, not just the 3D object.
- Planes carry the **same UV slots** (`fluorMask`, `uvInk`), so UV annotations can appear on deliverables.
- **Low GPU tier and `prefers-reduced-motion` fall back to plain DOM images.**

### 10.2 No distortion
- **No distortion, displacement, noise warping, RGB split or wobble anywhere on the site**, including hovers and page transitions.
- **Light is the only thing that changes.** Lamps strike, falloff moves, shadows move, emission glows. Images and type are never bent, warped, split or shaken.

## 8. References (what to take from each)

**Concept source**
- Pantone Light Booth, the real object and its illuminants: https://www.pantone.com/products/devices/pantone-light-booth
- 5-light booth spec (D50, A, TL84, CWF, UV; UV reveals optical brighteners; metamerism): https://colorconfidence.com/products/pantone-5-light-booth-d50

**Portfolio bar**
- Bruno Simon, the "describable in one sentence" benchmark: https://bruno-simon.com
- Igloo Inc, object-centric WebGL, material and sound quality, how restraint reads as luxury: https://www.igloo.inc
- Lusion, lighting quality and a persistent canvas across navigation: https://lusion.co
- Active Theory, production-grade WebGL that still loads: https://activetheory.net
- Stas Bondar portfolio case study, good process write-up, and the trap to avoid (stuffing every technique in): https://www.awwwards.com/case-study-stas-bondar-25.html
- Liya Kedar, same grid redrawn in different modes, the mode switch as the demo reel (closest structural cousin to the lamp idea): https://www.designrush.com/best-designs/websites/liya-kedar-website-design
- Wildy Riftian, archive built from physical objects and strict grid: https://www.wildyriftian.com
- Awwwards portfolio category, to sanity-check you're not converging on the same look: https://www.awwwards.com/websites/portfolio/

**Anti-reference**
- The flashlight cursor trend, already everywhere since 2019, which is why AFTER DARK is only one of seven lamps: https://speckyboy.com/flashlight-effect-web-design-trend/

**Tech**
- React Three Fiber: https://r3f.docs.pmnd.rs
- Drei (ContactShadows, AccumulativeShadows, PerformanceMonitor, useVideoTexture): https://drei.docs.pmnd.rs
- three.js RectAreaLight example (the booth top panel): https://threejs.org/examples/#webgl_lights_rectarealight
- three.js SpotLight with texture map (hand lamp gobo): https://threejs.org/examples/#webgl_lights_spotlight
- pmndrs postprocessing (bloom, colour matrix, noise): https://github.com/pmndrs/postprocessing
- glTF Transform (meshopt, KTX2): https://gltf-transform.dev
- GSAP: https://gsap.com
- Lenis: https://lenis.darkroom.engineering
- Geist + Geist Mono: https://vercel.com/font
- Vercel custom domains: https://vercel.com/docs/domains
- Cloudflare R2: https://developers.cloudflare.com/r2/

---

## 9. Kill criteria (be honest with yourself)
- If a first-time visitor can't name the idea after 10 seconds, the loader or headline is failing. Fix copy before adding effects.
- If a recruiter can't reach a project in 3 seconds, House Lights isn't prominent enough.
- If any lamp looks like a colour filter instead of light, it's not done. Lamps must change shadows, specular and falloff, not just hue.
- If you catch yourself adding an eighth lamp or a second gimmick, stop. One idea, executed at absurd quality, is what wins Site of the Year. Breadth is what made the last site forgettable.
