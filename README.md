# Stickers by Number Scraper

Playwright scraper for https://www.voxelguy.fr/stickersbynumber/.

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
```

## Run

```bash
pnpm scrape -- --max-id=100
```

The script writes JSON to `output/stickers.json`.

You can change the limit:

```bash
pnpm scrape -- --max-id=500
```

Or change the output file:

```bash
pnpm scrape -- --max-id=100 --output=output/test.json
```
