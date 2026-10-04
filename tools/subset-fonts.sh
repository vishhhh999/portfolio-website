#!/bin/sh
# I7: subset Geist + Geist Mono (variable) to the characters the site uses: Basic Latin, Latin-1
# (incl. · and ×), Latin Extended-A (ē in The Graphē), typographic quotes, the en dash in year
# ranges, the ellipsis, arrows (→ ← ↑ ↓ ↗) and the bullet. Needs fonttools + brotli (pip).
set -e
cd "$(dirname "$0")/.."
U="U+0020-007E,U+00A0-00FF,U+0100-017F,U+2013,U+2018-201E,U+2022,U+2026,U+2190-2193,U+2197,U+2212"
pyftsubset node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2 --unicodes="$U" --flavor=woff2 --layout-features='kern,liga,calt,tnum,ss01' --output-file=app/fonts/geist-sans-subset.woff2
pyftsubset "node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2" --unicodes="$U" --flavor=woff2 --layout-features='kern,tnum' --output-file=app/fonts/geist-mono-subset.woff2
ls -la node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2 node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2 app/fonts/*.woff2
