# LAUNCH: moving www.visheshmahendru.com from Framer to Vercel

Who does this: Vishesh. Nothing in this repo changes DNS. Allow about an hour, plus up to a day for DNS to settle everywhere.

The Vercel project is `vishafterdark-projects/portfolio-website`. The `main` branch is what goes live.

---

## 0. Before you start (10 minutes)

1. Check that the latest `main` deploy is green in Vercel (Deployments tab, top row says **Ready**).
2. Open that deploy's URL and click through `/`, one project, `/about` and `/archive`.
3. Write down your current DNS records at the registrar (screenshot the DNS page). This is your rollback.
4. In Framer, note the site's current Framer URL (something like `yoursite.framer.website`). It keeps working after the move, so it is your fallback.

## 1. Add the domain in Vercel

1. Vercel → project `portfolio-website` → **Settings → Domains**.
2. Add `www.visheshmahendru.com`.
3. Add `visheshmahendru.com` (the bare domain) and choose **Redirect to www.visheshmahendru.com** (308). The site's canonical URLs all use `www`.
4. Vercel now shows the records it wants. Normally:

| Host | Type | Value |
|---|---|---|
| `www` | CNAME | `cname.vercel-dns.com` |
| `@` (bare domain) | A | `76.76.21.21` |

Use the exact values Vercel shows on that page if they differ from the table.

## 2. Change DNS at the registrar

1. Remove the records that point `www` and `@` at Framer. Framer usually uses an A record on `@` and a CNAME on `www` pointing at a Framer host.
2. Add the two records from step 1.4.
3. Leave every other record alone, especially **MX** (email for work@visheshmahendru.com), TXT/SPF/DKIM, and any verification records. Email must keep working.
4. If the registrar shows a TTL, 300 seconds (5 minutes) is fine.

Back in Vercel → Domains, both rows turn green ("Valid Configuration"), and Vercel issues the HTTPS certificate on its own. This takes a few minutes to a few hours.

## 3. Keep Framer as a fallback for a week

- Do not delete or unpublish the Framer project for 7 days.
- In Framer → Site Settings → Domains, remove the custom domain **after** DNS has switched (otherwise Framer keeps showing a domain warning). The site stays reachable at its free Framer URL.
- If anything is wrong in that week, rollback is just DNS (section 6).

## 4. Verify after the cutover

Run these from any terminal once Vercel shows the domain as valid (or use https://httpstatus.io in a browser).

**Redirects (old Framer links in job applications must land on the new pages, status 301):**

```bash
for s in too-yumm mitooshi bengal-t20-league house-of-hex indothai shunya sonde sook jsw-sports; do
  curl -sI https://www.visheshmahendru.com/projects/$s | grep -iE '^(HTTP|location)'
done
curl -sI https://visheshmahendru.com/ | grep -iE '^(HTTP|location)'      # 308 to https://www.visheshmahendru.com/
```

Each `/projects/...` must answer `301` with `location: /work/<slug>` (`indothai` → `/work/indo-thai`, `bengal-t20-league` → `/work/bengal-t20`).

**Canonical URLs:** open any page, View Source, search for `rel="canonical"`. It must be `https://www.visheshmahendru.com/...` (the page's own path).

**Sitemap and robots:**

- https://www.visheshmahendru.com/sitemap.xml lists `/`, nine `/work/...` pages, `/archive`, `/about`, `/house-lights`.
- https://www.visheshmahendru.com/robots.txt points at that sitemap.
- Submit the sitemap in Google Search Console (add the domain property if it is not there yet).

**Share cards (OG):**

- Paste `https://www.visheshmahendru.com/` and one project URL into https://www.opengraph.xyz (or LinkedIn's Post Inspector: https://www.linkedin.com/post-inspector/).
- The card shows the booth (home) or the project's tray shot with its name.
- LinkedIn caches old cards. The Post Inspector's "Inspect" button refreshes them.

**The site itself:** `/`, a project under each lamp (keys 1 to 7), `/about`, `/archive`, the 404 (any made-up URL), and the "Book a viewing" button (it should open your mail app with the message filled in).

## 5. Turn on Vercel Analytics

Vercel → project → **Analytics** tab → **Enable**. The code is already in place (`<Analytics/>` in `app/layout.tsx`, active only on Vercel). Custom events (lamp picked, project opened, CV downloaded, email copied, Book a viewing, outbound links) show up under **Events** a few minutes after the first visits.

Optional: **Speed Insights** in the same place, for real-visitor performance numbers.

## 6. Rollback plan

If the new site misbehaves and you cannot wait for a fix:

1. At the registrar, put back the old Framer records from your screenshot (step 0.3), and remove the Vercel ones.
2. In Framer, re-add the custom domain.
3. With a 300-second TTL, most visitors are back on Framer within minutes; some networks can take up to a few hours.

To roll back only the code (not the domain), use Vercel → Deployments → pick the last good deploy → **Promote to Production**. That is instant.

## 7. Things in the codebase to know

- **No preview URL is hard-coded** in the code. The only preview URLs are in the hand-written docs (`HANDOVER.md`, `DELIVERY-*.md`).
- In production, `metadataBase` and every canonical and OG URL use `https://www.visheshmahendru.com` (`app/layout.tsx`, `lib/site.ts`). On a Vercel **preview** they use that preview's own branch URL (`VERCEL_BRANCH_URL`), so share cards can be checked there; previews are behind Vercel login, so outside scrapers (LinkedIn, X) cannot fetch them until production.
- The sitemap and robots.txt always name `https://www.visheshmahendru.com` (`lib/site.ts` `SITE_URL`).
- `next.config.ts` allows images from `media.visheshmahendru.com` (unused today; harmless).
- `/index` redirects to `/house-lights` (an old route); `/projects/*` redirects to `/work/*`.
