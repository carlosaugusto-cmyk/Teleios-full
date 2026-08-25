#!/usr/bin/env node
// Generate PWA icons from SVG
// Run: node scripts/generate-icons.js
// Requires: npm install sharp

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputSvg = path.resolve('public/icons/icon.svg');
const outputDir = path.resolve('public/icons');

async function generateIcons() {
  if (!fs.existsSync(inputSvg)) {
    console.error('SVG not found:', inputSvg);
    process.exit(1);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const svgBuffer = fs.readFileSync(inputSvg);

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${outputPath}`);
  }

  // Generate badge (72x72 for notifications)
  const badgePath = path.join(outputDir, 'badge-72.png');
  await sharp(svgBuffer)
    .resize(72, 72)
    .png()
    .toFile(badgePath);
  console.log(`Generated: ${badgePath}`);

  // Generate apple-touch-icon (180x180)
  const applePath = path.join(outputDir, 'apple-touch-icon.png');
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(applePath);
  console.log(`Generated: ${applePath}`);

  // Generate safari-pinned-tab.svg (monochrome)
  const safariSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <g transform="translate(256, 256)">
    <rect x="-28" y="-90" width="56" height="180" rx="8" fill="#0F2B5C" />
    <rect x="-70" y="-16" width="140" height="56" rx="8" fill="#0F2B5C" />
  </g>
</svg>`;
  fs.writeFileSync(path.join(outputDir, 'safari-pinned-tab.svg'), safariSvg);
  console.log('Generated: safari-pinned-tab.svg');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);