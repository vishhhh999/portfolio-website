# Masters report (masters-v1)

Source: `masters-v1.zip` from the GitHub release, 89 PNG masters.

| | count |
|---|---|
| matched and re-encoded | 43 |
| still indexed (colour type 3), not used | 44 |
| unmatched | 0 |
| ties | 2 |
| conflicts | 0 |
| current images with no master | 8 |

Payload of the matched images: 11592 KB before (WebP from 256-colour sources) → 10276 KB AVIF (served first) / 15595 KB WebP fallback.

## Matched

AVIF quality is the lowest at which smooth regions (gentle gradients and flats, where banding would show) stay within 3 levels (99.9th percentile) and 8 levels (worst pixel) of the master after a 2px blur (which removes the masters' fine grain but keeps every step), with the whole image at 36 dB PSNR or better. WebP fallback at quality 86.

| master | replaces | match | AVIF q | gradient error p99.9 / worst (levels) | all PSNR | before | AVIF | WebP |
|---|---|---|---|---|---|---|---|---|
| masters-v1/about-portrait/portrait.png | public/about/portrait.webp | explicit folder about-portrait/ | 50 | 2 / 4 | 41.5 dB | 0 KB | 38 KB | 79 KB |
| masters-v1/bengal-t20-league/Frame 1000002258.png | public/work/bengal-t20/01.webp | dHash 1, aHash 0 | 68 | 3 / 7 | 36.4 dB | 507 KB | 429 KB | 563 KB |
| masters-v1/bengal-t20-league/Frame 1000002259.png | public/work/bengal-t20/02.webp | dHash 0, aHash 0 | 68 | 3 / 7 | 36.9 dB | 380 KB | 379 KB | 478 KB |
| masters-v1/bengal-t20-league/Frame 1000002260.png | public/work/bengal-t20/06.webp | dHash 0, aHash 0 | 68 | 3 / 7 | 36.7 dB | 465 KB | 440 KB | 599 KB |
| masters-v1/bengal-t20-league/Frame 1000002261.png | public/work/bengal-t20/04.webp | dHash 0, aHash 0 | 62 | 3 / 8 | 36.4 dB | 363 KB | 226 KB | 437 KB |
| masters-v1/bengal-t20-league/Frame 1000002262.png | public/work/bengal-t20/05.webp | dHash 0, aHash 0 | 68 | 3 / 6 | 36.9 dB | 387 KB | 412 KB | 529 KB |
| masters-v1/bengal-t20-league/Frame 1000002263.png | public/work/bengal-t20/03.webp | dHash 0, aHash 0 | 74 | 3 / 6 | 37.7 dB | 392 KB | 473 KB | 480 KB |
| masters-v1/house-of-hex/Frame 1000002253.png | public/work/house-of-hex/02.webp | dHash 0, aHash 0 | 62 | 3 / 8 | 36.9 dB | 462 KB | 448 KB | 605 KB |
| masters-v1/house-of-hex/Frame 1000002254.png | public/work/house-of-hex/03.webp | dHash 0, aHash 0 | 56 | 3 / 8 | 36.5 dB | 367 KB | 251 KB | 510 KB |
| masters-v1/house-of-hex/Frame 1000002255.png | public/work/house-of-hex/04.webp | dHash 3, aHash 2 | 56 | 3 / 7 | 37.1 dB | 374 KB | 285 KB | 534 KB |
| masters-v1/indo-thai/Frame 1000002266.png | public/work/indo-thai/02.webp | dHash 0, aHash 4 | 62 | 3 / 6 | 39.5 dB | 126 KB | 98 KB | 151 KB |
| masters-v1/indo-thai/Frame 1000002267.png | public/work/indo-thai/03.webp | dHash 1, aHash 1 | 68 | 3 / 5 | 39.5 dB | 163 KB | 201 KB | 203 KB |
| masters-v1/indo-thai/Frame 1000002271.png | public/work/indo-thai/04.webp | dHash 0, aHash 1 | 56 | 3 / 8 | 38.9 dB | 135 KB | 93 KB | 202 KB |
| masters-v1/jsw-sports/Frame 1000002272.png | public/work/jsw-sports/01.webp | dHash 1, aHash 0 | 68 | 3 / 7 | 38.5 dB | 242 KB | 350 KB | 350 KB |
| masters-v1/jsw-sports/Frame 1000002273.png | public/work/jsw-sports/02.webp | dHash 1, aHash 0 | 62 | 3 / 7 | 37.6 dB | 185 KB | 150 KB | 269 KB |
| masters-v1/jsw-sports/Frame 1000002274.png | public/work/jsw-sports/06.webp | dHash 2, aHash 0 | 68 | 3 / 6 | 36.4 dB | 687 KB | 619 KB | 840 KB |
| masters-v1/jsw-sports/Frame 1000002275.png | public/work/jsw-sports/04.webp | dHash 2, aHash 0 | 68 | 3 / 5 | 36.4 dB | 690 KB | 608 KB | 869 KB |
| masters-v1/jsw-sports/Frame 1000002276.png | public/work/jsw-sports/05.webp | dHash 0, aHash 0 | 74 | 3 / 5 | 36.1 dB | 771 KB | 797 KB | 934 KB |
| masters-v1/jsw-sports/Frame 1000002277.png | public/work/jsw-sports/03.webp | dHash 0, aHash 1 | 74 | 3 / 7 | 36.5 dB | 699 KB | 712 KB | 856 KB |
| masters-v1/mitooshi/Frame 1000002237.png | public/work/mitooshi/01.webp | dHash 0, aHash 0 | 62 | 3 / 8 | 37.8 dB | 179 KB | 250 KB | 410 KB |
| masters-v1/mitooshi/Frame 1000002242.png | public/work/mitooshi/02.webp | dHash 1, aHash 0 | 56 | 3 / 7 | 37.5 dB | 298 KB | 211 KB | 448 KB |
| masters-v1/shunya/Frame 1000002287.png | public/work/shunya/04.webp | dHash 1, aHash 0 | 50 | 3 / 8 | 39.2 dB | 128 KB | 47 KB | 140 KB |
| masters-v1/shunya/Frame 1000002288.png | public/work/shunya/05.webp | dHash 1, aHash 0 | 50 | 2 / 5 | 39.2 dB | 94 KB | 29 KB | 151 KB |
| masters-v1/shunya/Frame 1000002290.png | public/work/shunya/02.webp | dHash 1, aHash 0 | 50 | 3 / 8 | 38.9 dB | 140 KB | 56 KB | 152 KB |
| masters-v1/shunya/Frame 1000002292.png | public/work/shunya/03.webp | dHash 0, aHash 1 | 62 | 3 / 8 | 38.9 dB | 136 KB | 81 KB | 144 KB |
| masters-v1/sonde/Frame 1000002294.png | public/work/sonde/01.webp | dHash 3, aHash 0 | 56 | 3 / 7 | 40.1 dB | 96 KB | 98 KB | 166 KB |
| masters-v1/sonde/Frame 1000002295.png | public/work/sonde/02.webp | dHash 5, aHash 0 | 50 | 3 / 6 | 38.5 dB | 89 KB | 84 KB | 240 KB |
| masters-v1/sonde/Frame 1000002296.png | public/work/sonde/06.webp | dHash 5, aHash 1 | 50 | 2 / 7 | 38.6 dB | 91 KB | 86 KB | 247 KB |
| masters-v1/sonde/Frame 1000002297.png | public/work/sonde/04.webp | dHash 3, aHash 3 | 56 | 3 / 8 | 39.2 dB | 93 KB | 110 KB | 253 KB |
| masters-v1/sonde/Frame 1000002298.png | public/work/sonde/05.webp | dHash 1, aHash 0 | 62 | 3 / 6 | 39.6 dB | 104 KB | 166 KB | 251 KB |
| masters-v1/sonde/Frame 1000002299.png | public/work/sonde/03.webp | dHash 2, aHash 1 | 50 | 3 / 8 | 40.9 dB | 52 KB | 46 KB | 101 KB |
| masters-v1/sook/Frame 1000002245.png | public/work/sook/01.webp | dHash 0, aHash 2 | 56 | 3 / 7 | 38.9 dB | 108 KB | 73 KB | 144 KB |
| masters-v1/sook/Frame 1000002246.png | public/work/sook/05.webp | dHash 0, aHash 0 | 56 | 3 / 8 | 36.3 dB | 326 KB | 203 KB | 435 KB |
| masters-v1/sook/Frame 1000002247.png | public/work/sook/06.webp | dHash 2, aHash 0 | 62 | 2 / 8 | 39.2 dB | 109 KB | 82 KB | 148 KB |
| masters-v1/sook/Frame 1000002248.png | public/work/sook/04.webp | dHash 4, aHash 0 | 56 | 3 / 8 | 38.9 dB | 141 KB | 61 KB | 139 KB |
| masters-v1/sook/Frame 1000002249.png | public/work/sook/03.webp | dHash 1, aHash 0 | 50 | 3 / 8 | 38.4 dB | 123 KB | 56 KB | 156 KB |
| masters-v1/sook/Frame 1000002250.png | public/work/sook/02.webp | dHash 0, aHash 1 | 62 | 3 / 7 | 39.3 dB | 109 KB | 95 KB | 140 KB |
| masters-v1/too-yumm/Frame 1000002223.png | public/work/too-yumm/01.webp | dHash 0, aHash 0 | 56 | 3 / 7 | 37.7 dB | 185 KB | 102 KB | 245 KB |
| masters-v1/too-yumm/Frame 1000002224.png | public/work/too-yumm/02.webp | dHash 0, aHash 0 | 56 | 3 / 8 | 37.4 dB | 189 KB | 116 KB | 252 KB |
| masters-v1/too-yumm/Frame 1000002225.png | public/work/too-yumm/06.webp | dHash 0, aHash 1 | 68 | 3 / 5 | 37.2 dB | 491 KB | 482 KB | 607 KB |
| masters-v1/too-yumm/Frame 1000002226.png | public/work/too-yumm/04.webp | dHash 1, aHash 0 | 56 | 3 / 7 | 37.4 dB | 214 KB | 122 KB | 260 KB |
| masters-v1/too-yumm/Frame 1000002227.png | public/work/too-yumm/05.webp | dHash 0, aHash 0 | 68 | 3 / 6 | 37.1 dB | 494 KB | 484 KB | 610 KB |
| masters-v1/too-yumm/Frame 1000002228.png | public/work/too-yumm/03.webp | dHash 0, aHash 0 | 56 | 3 / 8 | 37 dB | 208 KB | 128 KB | 268 KB |

## Still indexed (not used)

- masters-v1/archive/archive-01.png → public/archive/01.webp: dHash 0, aHash 1
- masters-v1/archive/archive-02.png → public/archive/02.webp: dHash 0, aHash 0
- masters-v1/archive/archive-03.png → public/archive/03.webp: dHash 0, aHash 0
- masters-v1/archive/archive-04.png → public/archive/04.webp: dHash 0, aHash 0
- masters-v1/archive/archive-05.png → public/archive/05.webp: dHash 0, aHash 0
- masters-v1/archive/archive-06.png → public/archive/06.webp: dHash 0, aHash 0
- masters-v1/archive/archive-07.png → public/archive/07.webp: dHash 0, aHash 0
- masters-v1/archive/archive-08.png → public/archive/08.webp: dHash 0, aHash 0
- masters-v1/archive/archive-09.png → public/archive/09.webp: dHash 0, aHash 0
- masters-v1/archive/archive-10.png → public/archive/10.webp: dHash 0, aHash 0
- masters-v1/archive/archive-11.png → public/archive/11.webp: dHash 0, aHash 0
- masters-v1/archive/archive-12.png → public/archive/12.webp: dHash 0, aHash 0
- masters-v1/archive/archive-13.png → public/archive/13.webp: dHash 1, aHash 0
- masters-v1/archive/archive-14.png → public/archive/14.webp: dHash 0, aHash 0
- masters-v1/archive/archive-15.png → public/archive/15.webp: dHash 0, aHash 2
- masters-v1/archive/archive-16.png → public/archive/16.webp: dHash 0, aHash 0
- masters-v1/archive/archive-17.png → public/archive/17.webp: dHash 0, aHash 0
- masters-v1/archive/archive-18.png → public/archive/18.webp: dHash 1, aHash 0
- masters-v1/archive/archive-19.png → public/archive/19.webp: dHash 0, aHash 0
- masters-v1/archive/archive-20.png → public/archive/20.webp: dHash 0, aHash 0
- masters-v1/archive/archive-21.png → public/archive/21.webp: dHash 2, aHash 0
- masters-v1/archive/archive-22.png → public/archive/22.webp: dHash 3, aHash 1
- masters-v1/archive/archive-23.png → public/archive/23.webp: dHash 0, aHash 0
- masters-v1/archive/archive-24.png → public/archive/24.webp: dHash 0, aHash 0
- masters-v1/archive/archive-25.png → public/archive/25.webp: dHash 0, aHash 0
- masters-v1/archive/archive-26.png → public/archive/26.webp: dHash 0, aHash 0
- masters-v1/archive/archive-27.png → public/archive/27.webp: dHash 0, aHash 0
- masters-v1/archive/archive-30.png → public/archive/30.webp: dHash 0, aHash 0
- masters-v1/archive/archive-31.png → public/archive/31.webp: dHash 0, aHash 0
- masters-v1/archive/archive-32.png → public/archive/32.webp: dHash 0, aHash 0
- masters-v1/archive/archive-33.png → public/archive/33.webp: dHash 2, aHash 0
- masters-v1/archive/archive-34.png → public/archive/34.webp: dHash 1, aHash 1
- masters-v1/archive/archive-35.png → public/archive/35.webp: dHash 1, aHash 0
- masters-v1/archive/archive-36.png → public/archive/36.webp: dHash 0, aHash 0
- masters-v1/archive/archive-37.png → public/archive/37.webp: dHash 0, aHash 0
- masters-v1/archive/archive-38.png → public/archive/38.webp: dHash 0, aHash 0
- masters-v1/archive/archive-39.png → public/archive/39.webp: dHash 0, aHash 0
- masters-v1/archive/archive-40.png → public/archive/40.webp: dHash 0, aHash 0
- masters-v1/archive/archive-41.png → public/archive/41.webp: dHash 2, aHash 0
- masters-v1/archive/archive-42.png → public/archive/42.webp: dHash 1, aHash 1
- masters-v1/archive/archive-43.png → public/archive/43.webp: dHash 0, aHash 0
- masters-v1/archive/archive-44.png → public/archive/44.webp: dHash 0, aHash 0
- masters-v1/archive/archive-45.png → public/archive/45.webp: dHash 0, aHash 1
- masters-v1/archive/archive-46.png → public/archive/46.webp: dHash 0, aHash 0

## Unmatched

None.

## Ties

- masters-v1/archive/archive-28.png: public/archive/28.webp (0/0) vs public/archive/29.webp (1/0)
- masters-v1/archive/archive-29.png: public/archive/29.webp (0/0) vs public/archive/28.webp (1/0)

## Conflicts

None.

## Current images with no master

- public/archive/28.webp
- public/archive/29.webp
- public/work/house-of-hex/01-poster.webp
- public/work/indo-thai/01-poster.webp
- public/work/mitooshi/03-poster.webp
- public/work/shunya/01-poster.webp

## No master needed

