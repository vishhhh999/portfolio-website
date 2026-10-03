'use client';

import { useEffect, useRef } from 'react';
import { registerFrame } from '@/lib/views';

/** An empty box in the page layout: the booth camera frames the cabinet into it. */
export function BoothFrame() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? registerFrame(ref.current) : undefined), []);
  return <div ref={ref} className="booth-frame" aria-hidden="true" />;
}
