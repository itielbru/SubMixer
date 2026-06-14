#!/usr/bin/env node
'use strict';

/**
 * Downloads Heebo, Assistant, and JetBrains Mono from Google Fonts as local
 * woff2 files and writes a fonts.css that the app loads instead of fetching
 * from the network. Run once before `npm run dev` or `npm run build`.
 *
 * Output directory: src/renderer/public/fonts/
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const FONTS_DIR = path.join(__dirname, '..', 'src', 'renderer', 'public', 'fonts');
const CSS_OUT = path.join(FONTS_DIR, 'fonts.css');

const GOOGLE_CSS =
  'https://fonts.googleapis.com/css2?family=Assistant:wght@300..800' +
  '&family=Heebo:wght@300..800' +
  '&family=JetBrains+Mono:wght@400..600' +
  '&display=swap';

// A modern Chrome UA so Google Fonts returns variable-font woff2 URLs.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function get(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get(
      { hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': UA } },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return resolve(get(res.headers.location));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }
    );
    req.on('error', reject);
  });
}

async function main() {
  fs.mkdirSync(FONTS_DIR, { recursive: true });

  console.log('Fetching Google Fonts CSS…');
  const css = (await get(GOOGLE_CSS)).toString('utf8');

  // Parse @font-face blocks
  const blockRe = /@font-face\s*\{([^}]+)\}/gs;
  const blocks = [...css.matchAll(blockRe)].map((m) => m[1]);

  // url -> { filename, family, style, weight, unicodeRange }
  const downloads = new Map();

  for (const block of blocks) {
    const urlM = block.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
    if (!urlM) continue;
    const url = urlM[1].trim();
    if (downloads.has(url)) continue;

    const familyM = block.match(/font-family:\s*['"]?([^;'"]+)/);
    const styleM = block.match(/font-style:\s*([^;]+)/);
    const weightM = block.match(/font-weight:\s*([^;]+)/);
    const unicodeM = block.match(/unicode-range:\s*([^;]+)/);

    const family = (familyM ? familyM[1].trim() : 'Font').replace(/\s+/g, '');
    const filename = `${family}-${downloads.size}.woff2`;

    downloads.set(url, {
      filename,
      family: familyM ? familyM[1].trim() : family,
      style: styleM ? styleM[1].trim() : 'normal',
      weight: weightM ? weightM[1].trim() : '400',
      unicodeRange: unicodeM ? unicodeM[1].trim() : null,
    });
  }

  // Download missing files
  for (const [url, meta] of downloads) {
    const dest = path.join(FONTS_DIR, meta.filename);
    if (fs.existsSync(dest)) {
      console.log(`  skip  ${meta.filename} (exists)`);
    } else {
      console.log(`  fetch ${meta.filename}…`);
      const buf = await get(url);
      fs.writeFileSync(dest, buf);
    }
  }

  // Write fonts.css
  const cssBlocks = [];
  for (const [, meta] of downloads) {
    const lines = [
      `@font-face {`,
      `  font-family: '${meta.family}';`,
      `  font-style: ${meta.style};`,
      `  font-weight: ${meta.weight};`,
      `  font-display: swap;`,
      `  src: url('./${meta.filename}') format('woff2');`,
    ];
    if (meta.unicodeRange) lines.push(`  unicode-range: ${meta.unicodeRange};`);
    lines.push('}');
    cssBlocks.push(lines.join('\n'));
  }
  fs.writeFileSync(CSS_OUT, cssBlocks.join('\n') + '\n');
  console.log(`\nWrote ${CSS_OUT}`);
  console.log('Done. Run npm run dev to use local fonts.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
