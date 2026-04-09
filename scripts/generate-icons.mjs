import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public')

// Read base SVG (black on transparent)
const baseSvg = readFileSync(join(publicDir, 'flow-io-logomark.svg'), 'utf-8')

// Create color variants
const whiteSvg = baseSvg
  .replace(/fill:#000000/g, 'fill:#FFFFFF')
  .replace(/stroke:#000000/g, 'stroke:#FFFFFF')

const goldSvg = baseSvg
  .replace(/fill:#000000/g, 'fill:#F59E0B')
  .replace(/stroke:#000000/g, 'stroke:#F59E0B')

// Write SVG variants
writeFileSync(join(publicDir, 'flow-io-logomark-white.svg'), whiteSvg)
writeFileSync(join(publicDir, 'flow-io-logomark-gold.svg'), goldSvg)

console.log('SVG variants created')

// Render SVG to PNG at a given size using resvg (high-quality antialiasing)
function svgToPng(svgContent, outputPath, size) {
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: 'width', value: size },
  })
  const rendered = resvg.render()
  writeFileSync(outputPath, rendered.asPng())
  console.log(`Generated: ${outputPath} (${size}x${size})`)
}

// Render SVG to PNG buffer
function svgToPngBuffer(svgContent, size) {
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: 'width', value: size },
  })
  return Buffer.from(resvg.render().asPng())
}

// Build ICO file from PNG buffers
function generateIco(svgContent, outputPath) {
  const png16 = svgToPngBuffer(svgContent, 16)
  const png32 = svgToPngBuffer(svgContent, 32)

  const images = [
    { size: 16, data: png16 },
    { size: 32, data: png32 },
  ]

  // ICO Header: 6 bytes
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // Reserved
  header.writeUInt16LE(1, 2) // Type: ICO
  header.writeUInt16LE(images.length, 4) // Number of images

  // Directory entries: 16 bytes each
  const dirEntries = []
  let dataOffset = 6 + images.length * 16

  for (const img of images) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1)
    entry.writeUInt8(0, 2)
    entry.writeUInt8(0, 3)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(img.data.length, 8)
    entry.writeUInt32LE(dataOffset, 12)
    dirEntries.push(entry)
    dataOffset += img.data.length
  }

  const ico = Buffer.concat([header, ...dirEntries, ...images.map((i) => i.data)])
  writeFileSync(outputPath, ico)
  console.log(`Generated: ${outputPath}`)
}

// Wrap logomark SVG with a dark rounded-rect background
function wrapWithBackground(svgContent, bgColor) {
  const inner = svgContent
    .replace(/<\?xml[^?]*\?>/, '')
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="220" fill="${bgColor}"/>
  <g transform="scale(0.75) translate(170, 170)">
    ${inner}
  </g>
</svg>`
}

function main() {
  // 1. Large PNGs for each color variant (1024px)
  svgToPng(baseSvg, join(publicDir, 'flow-io-logomark.png'), 1024)
  svgToPng(baseSvg, join(publicDir, 'flow-io-logomark-black.png'), 1024)
  svgToPng(whiteSvg, join(publicDir, 'flow-io-logomark-white.png'), 1024)
  svgToPng(goldSvg, join(publicDir, 'flow-io-logomark-gold.png'), 1024)

  // 2. Favicon with dark background + white logo
  const faviconSvg = wrapWithBackground(whiteSvg, '#0a0a0a')

  // 3. PWA icons
  svgToPng(faviconSvg, join(publicDir, 'icon-192.png'), 192)
  svgToPng(faviconSvg, join(publicDir, 'icon-512.png'), 512)

  // 4. Apple touch icon (180x180)
  svgToPng(faviconSvg, join(publicDir, 'apple-touch-icon.png'), 180)

  // 5. Favicon ICO
  generateIco(faviconSvg, join(root, 'app', 'favicon.ico'))

  // 6. Dev favicon - gold on dark
  const devFaviconSvg = wrapWithBackground(goldSvg, '#0a0a0a')
  generateIco(devFaviconSvg, join(publicDir, 'favicon-dev.ico'))
  svgToPng(devFaviconSvg, join(publicDir, 'favicon-dev.png'), 32)

  console.log('\nAll icons generated successfully!')
}

main()
