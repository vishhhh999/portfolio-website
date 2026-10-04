export const CONTACT_EMAIL = 'work@visheshmahendru.com';
export const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Book a viewing')}`;
export const SITE_URL = 'https://www.visheshmahendru.com';
export const SITE_HOST = 'www.visheshmahendru.com';
export const SITE_NAME = 'Vishesh Mahendru';
export const SITE_DESCRIPTION = 'Brand and digital design by Vishesh Mahendru. India, working worldwide.';
/** Social profiles, as on the live site. Used on /about and in the footer site-wide. */
export const SOCIALS = [
  { label: 'Instagram', href: 'https://www.instagram.com/vishafterdark/' },
  { label: 'Behance', href: 'https://www.behance.net/visheshmahendru' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/visheshmahendru/' },
] as const;
