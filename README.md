# THE WORLD IN ONE DAY — 19 November 2026

[![make.fun](https://img.shields.io/badge/make.fun-news--image--20261119-6C5CE7)](https://make.fun/bounty/news-image-20261119)
[![GitHub repo size](https://img.shields.io/github/repo-size/Djebrix/news-image-20261119)](https://github.com/Djebrix/news-image-20261119)
[![reward](https://img.shields.io/badge/reward-%24250-green)](https://make.fun/bounty/news-image-20261119)

A newspaper front page summing up Thursday 19 November 2026 in a single image,
entered in the [make.fun news-image-20261119 bounty](https://make.fun/bounty/news-image-20261119).

The front page leads with the first-ever trilateral summit of Trump, Xi and Putin
in Shenzhen, and covers the International Court of Justice ruling that Myanmar
committed acts of genocide against the Rohingya, Ukraine's third strike on the
Crimean Bridge in a week, Iran's retaliatory attacks on Gulf states, and
Anthropic's record $81.3 billion IPO. The "Also Today" strip adds COP31 in
Antalya, the GTA VI launch, Voyager 1 reaching one light-day from Earth, and a
record $190.4 million Van Gogh sale.

## How it works

`main.ts` draws the whole page itself: a hand-written 5x7 bitmap font, a small
canvas library (rectangles, lines, ellipses, polygons, stars), four drawn
illustrations (three national flags, the scales of justice, the broken bridge,
and two charts), and a from-scratch PNG encoder (CRC32, zlib via Node's
standard library). No network, no clock, no randomness — the output is fully
deterministic.

## Run it

```sh
# Node 22+
node main.ts
# writes entry.png (1024x1024, <= 1 MiB) to /output,
# or to $MAKEFUN_OUTPUT_DIR when set
MAKEFUN_OUTPUT_DIR=./out node main.ts
```

Run it twice to two different output directories and compare the SHA-256
hashes: they are byte-identical.

## License

MIT — see [LICENSE](LICENSE).
