'use client';

import { useBooth } from '@/lib/store';

/**
 * Print-production slug line, e.g. VM_PROOF_0047 · D50 · 2026-10. It always names the ACTIVE lamp
 * (I); the native lamp appears only on the calibration label and its chip. Archive-only projects
 * have no booth: they read ARCHIVE.
 */
export function SlugLine({ id, archive = false, date = '2026-10' }: { id: string | number; archive?: boolean; date?: string }) {
  const lamp = useBooth((s) => s.lamp);
  return (
    <p className="slug">
      VM_PROOF_{String(id).padStart(4, '0')} · {archive ? 'ARCHIVE' : lamp === 'AFTERDARK' ? 'AFTER DARK' : lamp} · {date}
    </p>
  );
}
