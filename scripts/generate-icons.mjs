// Generates the PWA PNG icons from a simple inline SVG using Playwright's
// bundled Chromium. Run: node scripts/generate-icons.mjs
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const OUT = new URL('../public/icons/', import.meta.url).pathname

// maskable: safe zone is the inner 80%, so the glyph shrinks and the tile
// fills the full canvas without rounded corners.
function svg(size, { maskable = false } = {}) {
  const radius = maskable ? 0 : Math.round(size * 0.22)
  const glyphScale = maskable ? 0.62 : 0.8
  const g = size * glyphScale
  const offset = (size - g) / 2
  return `<!doctype html><body style="margin:0">
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${radius}" fill="#4f46e5"/>
      <svg x="${offset}" y="${offset}" width="${g}" height="${g}" viewBox="0 0 64 64">
        <path d="M18 44V20l6-.001L40 36V20h6v24h-6L24 28v16z" fill="#fff"/>
      </svg>
    </svg></body>`
}

const targets = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180 },
]

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()
for (const { file, size, maskable } of targets) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(svg(size, { maskable: maskable ?? false }))
  await page.screenshot({ path: `${OUT}${file}`, omitBackground: true })
  console.warn(`wrote public/icons/${file}`)
}
await browser.close()
