/** Print-production slug line, e.g. VM_PROOF_0047 · D50 · 2026-10 */
export function SlugLine({ id, lamp, date = '2026-10' }: { id: string | number; lamp: string; date?: string }) {
  return (
    <p className="slug">
      VM_PROOF_{String(id).padStart(4, '0')} · {lamp} · {date}
    </p>
  );
}
