'use client';

import { track as vercelTrack } from '@vercel/analytics';

/**
 * Privacy-friendly analytics: Vercel Web Analytics (no cookies, no personal data) plus a few
 * custom events that show which work recruiters actually open. Event names and properties are
 * fixed strings and slugs only.
 */
export type AnalyticsEvent =
  | 'Lamp picked'
  | 'Project opened'
  | 'About opened'
  | 'Home view'
  | 'House lights toggled'
  | 'Sound toggled'
  | 'CV downloaded'
  | 'Email copied'
  | 'Outbound link'
  | 'Book a viewing';

export function track(event: AnalyticsEvent, props?: Record<string, string | number | boolean>) {
  try {
    vercelTrack(event, props);
  } catch {}
}
