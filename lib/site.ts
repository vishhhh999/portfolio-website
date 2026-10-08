export const CONTACT_EMAIL = 'work@visheshmahendru.com';
/**
 * M5 (09): every "Book a viewing" / contact link on the site opens the visitor's own mail app with
 * this message ready (a standard mailto:, never a Gmail-only compose URL). One helper, so every CTA
 * stays identical (tools/check-07.mjs asserts it).
 */
export const CONTACT_SUBJECT = "Saw your portfolio, let's connect";
export const CONTACT_BODY = "Hi Vishesh,\r\nI just went through your portfolio at www.visheshmahendru.com and really liked your work. I'd love to connect.";
/** RFC 6068: every reserved character percent-encoded, line breaks as %0D%0A. */
const mailEncode = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
export function contactMailto() {
  return `mailto:${CONTACT_EMAIL}?subject=${mailEncode(CONTACT_SUBJECT)}&body=${mailEncode(CONTACT_BODY)}`;
}
export const CONTACT_MAILTO = contactMailto();
export const SITE_URL = 'https://www.visheshmahendru.com';
export const SITE_HOST = 'www.visheshmahendru.com';
export const SITE_NAME = 'Vishesh Mahendru';
/** The CV (public/). */
export const CV_HREF = '/Vishesh-Mahendru-CV.pdf';
export const SITE_DESCRIPTION = 'Brand and digital design by Vishesh Mahendru. India, working worldwide.';
/** Social profiles, as on the live site. Used on /about and in the footer site-wide. */
export const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/vishafterdark/' },
  { label: 'Behance', href: 'https://www.behance.net/visheshmahendru' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/visheshmahendru/' },
] as const;
