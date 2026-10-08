'use client';

import { useEffect, useMemo, useRef } from 'react';
import { registerFrame } from '@/lib/views';
import { activeLayout, CABINET_FACE } from './staging';
import { shelfDef } from './shelf';
import { useLayoutKey } from './useLayout';
import { useShape } from '@/lib/shape';
import { BoothFocus } from './BoothFocus';
import { SampleTags } from './SampleTags';
import { BoothHint } from '@/components/ui/BoothHint';

export type FrameSample = { slug: string; title: string; meta: string };

/** The shelves' outer proportions (shelf.ts), as CSS aspect ratios for the frame before first paint. */
const SHELF2 = shelfDef(2), SHELF3 = shelfDef(3), SHELF4 = shelfDef(4);
/** L3 (09B): the square shape's frame: the four-column shelf, whole, at its own proportions. */
export const SQUARE_BOX = SHELF4.width / SHELF4.height;

/**
 * L1 + L6 (09B): the first poster is the one for the page's shape, chosen before first paint from
 * <html data-shape> (set by the boot script): wide → the cabinet, square → the square cabinet, tall →
 * the 2 or 3 column shelf. The browser fetches only that one. After a live shape change the booth is
 * already drawn, so no poster is needed.
 */
const POSTER_BOOT = `(function(){try{var d=document.documentElement,s=d.getAttribute('data-shape'),c=d.getAttribute('data-columns'),i=document.getElementById('booth-poster-img');if(!i)return;var n=s==='tall'?(c==='2'?'shelf2':'shelf3'):s==='square'?'shelf4':'cabinet';if(n==='cabinet'){i.srcset='/booth/poster-cabinet-1200.webp 1200w, /booth/poster-cabinet-2400.webp 2400w';i.sizes='min(100vw, 2560px)';i.src='/booth/poster-cabinet-1200.jpg';}else{i.srcset='/booth/poster-'+n+'-1x.webp 1x, /booth/poster-'+n+'-2x.webp 2x';i.src='/booth/poster-'+n+'-1x.webp';}d.setAttribute('data-poster',n);}catch(e){}})();`;

/**
 * A box in the page layout: the booth camera frames the arrangement into it.
 *   wide     the whole cabinet, as wide as the content (side bands ≤ 3% of the window), its height
 *            the cabinet's at that width
 *   square   the four-column shelf, three tiers, whole under the headline
 *   tall     the shelf, full content width, taller than the screen: the page scrolls down it
 *   phone-landscape  the cabinet in the full height under the masthead
 */
export function BoothFrame({ samples: given }: { samples: FrameSample[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const layoutKey = useLayoutKey();
  // L5 (09B): on the shelf the keyboard and the screen-reader order follow the shelf, row by row
  const samples = useMemo(() => {
    const L = activeLayout();
    if (!L.shelf) return given;
    const order = L.shelf.order;
    return [...given].sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
  }, [given, layoutKey]);

  useEffect(() => (ref.current ? registerFrame(ref.current) : undefined), []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const s = useShape.getState().shape;
      const wrap = el.parentElement!;
      el.style.maxHeight = 'none';
      // the stage the canvas draws into covers the frame (on the shelf the frame runs past the first screen)
      const stageH = () => document.documentElement.style.setProperty('--booth-stage-h', `${Math.ceil(el.getBoundingClientRect().bottom + window.scrollY + 24)}px`);
      if (s === 'tall') {
        // the shelf: full width, its own proportions (CSS, from <html data-columns>)
        el.style.height = el.style.width = '';
        stageH();
        return;
      }
      const vw = document.documentElement.clientWidth;
      const svh = useShape.getState().h;
      const slot = document.getElementById('panel-slot');
      // phone-landscape: the panel is a rail fixed along the bottom (≈ 52px with its margin)
      const panelH = s === 'phone-landscape' ? 58 : slot ? Math.max(56, slot.getBoundingClientRect().height) + 14 : 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const avail = Math.max(160, svh - top - panelH - 18);
      if (s === 'square') {
        // the square shelf: as large as the first screen allows, whole
        const h = Math.max(220, Math.min(avail, wrap.clientWidth / SQUARE_BOX));
        el.style.height = `${Math.round(h)}px`;
        el.style.width = `${Math.round(h * SQUARE_BOX)}px`;
        stageH();
        return;
      }
      // A4 (08): the box takes the cabinet's own aspect
      const aspect = CABINET_FACE.w / CABINET_FACE.h;
      let w = Math.max(280, Math.min(wrap.clientWidth, aspect * avail));
      // L3 (09B): no side band wider than 3% of the window: the cabinet grows to the content width and
      // the page scrolls a little further (the lamp panel follows under it)
      if (s === 'wide' && (vw - w) / 2 > 0.03 * vw) w = Math.min(wrap.clientWidth, Math.max(w, 0.94 * vw));
      el.style.width = `${Math.round(w)}px`;
      el.style.height = `${Math.round(w / aspect)}px`;
      stageH();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(document.body);
    window.addEventListener('resize', fit);
    document.fonts?.ready.then(fit);
    const off = useShape.subscribe(fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
      off();
    };
  }, []);

  return (
    <div className="booth-frame-wrap">
      <BoothFocus samples={samples} />
      <SampleTags samples={samples} />
      <div
        ref={ref}
        className="booth-frame"
        style={{
          ['--cab-aspect' as string]: `${CABINET_FACE.w} / ${CABINET_FACE.h}`,
          ['--shelf2-aspect' as string]: `${SHELF2.width} / ${SHELF2.height}`,
          ['--shelf3-aspect' as string]: `${SHELF3.width} / ${SHELF3.height}`,
          ['--square-aspect' as string]: `${SHELF4.width} / ${SHELF4.height}`,
        }}
        aria-hidden="true"
      >
        {/* C1 (08), L6 (09B): the LCP poster is this exact shot for the page's shape, rendered from the
            current staging (tools/make-posters.mjs; the build refuses a stale one), so the crossfade never jumps */}
        <div className="booth-poster">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img id="booth-poster-img" alt="" fetchPriority="high" decoding="async" suppressHydrationWarning />
          <script dangerouslySetInnerHTML={{ __html: POSTER_BOOT }} />
        </div>
        <BoothHint />
      </div>
    </div>
  );
}
