# MDMbox Documentation

Documentation for [MDMbox](https://www.health-samurai.io/mdmbox) — Master data management for healthcare organizations.

## Prerequisites

- [Bun](https://bun.sh) installed

## Setup

```bash
bun install
```

This installs [docs-tools](https://github.com/HealthSamurai/docs-tools) and sets up a pre-push git hook that runs lint before every push.

## Commands

```bash
bun lint                       # run all doc checks
bun lint:check broken-links    # run a single check
bun run assets:version         # refresh hashes on downloadable file links
bun run assets:check           # verify downloadable file hashes without editing
bun images:check               # find unoptimized images
bun images:optimize            # convert to AVIF + update refs
```

## Structure

```
docs/           # Markdown documentation files
assets/         # Images and other assets
SUMMARY.md      # Navigation structure
redirects.yaml  # URL redirects
```

## Contributing

1. `bun install` (once, sets up tools + pre-push hook)
2. Edit markdown files in `docs/` and downloadable files in `assets/`
3. Run `bun run assets:version` after changing downloadable files
4. Update `SUMMARY.md` if adding new pages
5. Run `bun lint` to check before pushing
6. Submit a pull request

Download links include a content-derived `?v=` parameter because the production CDN caches assets as immutable. CI rejects stale hashes, preventing an updated file from being published at an already-cached URL.

CI runs lint automatically on PRs. Image optimization runs on push to main.
