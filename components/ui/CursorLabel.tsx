'use client';

import { useEffect, useRef } from 'react';
import { cursorTarget } from '@/components/booth/focus';
import { spinDragging } from '@/lib/spin';

/**
 * M2 (09): a small mono label that follows the cursor over the booth: "Open <Project>" over a sample,
 * "Drag to turn" while one is pressed (or turning), "About" over the certificate. Fine pointers only;
 * none under reduced motion or in house lights. Decorative (aria-hidden): the booth's keyboard layer
 * and spec chips carry the same information.
 */
export function CursorLabel() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current!;
    let x = 0, y = 0, raf = 0, shown = '';
    const draw = () => {
      raf = 0;
      const house = document.documentElement.hasAttribute('data-house-lights');
      const text = house ? '' : cursorTarget.pressed || spinDragging() ? (cursorTarget.label || spinDragging() ? 'Drag to turn' : '') : cursorTarget.label ?? '';
      if (text !== shown) {
        shown = text;
        el.textContent = text;
        el.dataset.on = text ? 'true' : 'false';
      }
      el.style.transform = `translate(${Math.round(x + 16)}px, ${Math.round(y + 18)}px)`;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      raf ||= requestAnimationFrame(draw);
    };
    const onUp = () => (raf ||= requestAnimationFrame(draw));
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onUp, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onUp);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);
  return <div ref={ref} className="cursorlabel mono" aria-hidden="true" data-on="false" />;
}
