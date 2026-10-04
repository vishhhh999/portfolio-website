import type { Metadata } from 'next';
import { HouseIndex } from '@/components/ui/HouseIndex';

export const metadata: Metadata = {
  title: 'Index',
  description: 'Every project by Vishesh Mahendru, house lights on.',
  alternates: { canonical: '/house-lights' },
};

/** A shareable direct link to the flat index (for recruiters). Nothing in the UI sends visitors here. */
export default function IndexPage() {
  return (
    <section className="houselights">
      <HouseIndex />
    </section>
  );
}
