import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://www.voxelguy.fr/stickersbynumber/';
const DEFAULT_MAX_ID = 100;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    maxId: DEFAULT_MAX_ID,
    output: path.join(projectRoot, 'output', 'stickers.json'),
    headless: false
  };

  for (const arg of args) {
    const [key, value] = arg.split('=');

    if (key === '--max-id') {
      const maxId = Number(value);

      if (!Number.isInteger(maxId) || maxId < 1) {
        throw new Error('--max-id должен быть положительным целым числом');
      }

      options.maxId = maxId;
    }

    if (key === '--output') {
      options.output = path.resolve(projectRoot, value);
    }

    if (key === '--headed') {
      options.headless = false;
    }

    if (key === '--headless') {
      options.headless = true;
    }
  }

  return options;
}

async function readVisibleStickers(page, maxId) {
  return page.locator('.sticker-number.mb-2').evaluateAll((numberElements, limit) => {
    const result = {};

    for (const numberElement of numberElements) {
      let root = numberElement.parentElement;

      while (
        root &&
        (!root.querySelector('.sticker-name.mb-1') || !root.querySelector('.sticker-img.mb-2'))
      ) {
        root = root.parentElement;
      }

      const rawId = numberElement.textContent ?? '';
      const digits = rawId.replace(/\D/g, '');
      const id = digits.replace(/^0+/, '') || '0';
      const numericId = Number(id);

      if (!Number.isInteger(numericId) || numericId > limit) {
        continue;
      }

      const name = root?.querySelector('.sticker-name.mb-1')?.textContent?.trim() ?? '';
      const img = root?.querySelector('.sticker-img.mb-2');
      const iconLink = img instanceof HTMLImageElement ? img.src : (img?.getAttribute('src') ?? '');

      result[id] = {
        Name: name,
        iconLink
      };
    }

    return result;
  }, maxId);
}

async function scrollUntilLoaded(page, maxId) {
  const stickers = {};
  let previousCount = 0;
  let stableScrolls = 0;

  while (stableScrolls < 5) {
    const visibleStickers = await readVisibleStickers(page, maxId);

    Object.assign(stickers, visibleStickers);

    const currentCount = Object.keys(stickers).length;

    if (currentCount === previousCount) {
      stableScrolls += 1;
    } else {
      stableScrolls = 0;
      previousCount = currentCount;
      console.log(`Loaded ${currentCount} stickers up to ID ${maxId}`);
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1200);
  }

  return Object.fromEntries(
    Object.entries(stickers).sort(([left], [right]) => Number(left) - Number(right))
  );
}

async function main() {
  const options = parseArgs();
  const browser = await chromium.launch({ headless: options.headless });
  const page = await browser.newPage();

  try {
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sticker-number.mb-2', { timeout: 30000 });

    const stickers = await scrollUntilLoaded(page, options.maxId);

    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(stickers, null, 2)}\n`);

    console.log(`Saved ${Object.keys(stickers).length} stickers to ${options.output}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
