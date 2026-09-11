// Generates the app icon / splash sources from the brand palette, then
// @capacitor/assets fans them out into every Android density.
//   npm run icons
import sharp from 'sharp'

const PURPLE = '#6B4EFF'
const PURPLE_LIGHT = '#8B5CF6'
const DARK = '#0D0F13'
const LIGHT = '#E6E8EE'

// A cartridge whose label doubles as a catalog card. `scale` is a fraction of
// the artboard, so the adaptive-icon foreground can sit inside its safe zone.
function glyph(size, scale, bodyFill = LIGHT, markFill = PURPLE) {
  const c = size / 2
  const w = size * 0.5 * scale
  const h = size * 0.586 * scale
  const x = c - w / 2
  const y = c - h / 2
  const r = w * 0.11
  const lx = x + w * 0.14
  const lw = w * 0.72
  const rowH = h * 0.055
  const rowGap = h * 0.105
  const rows = [0, 1, 2]
    .map((i) => {
      const width = lw * [1, 0.82, 0.6][i]
      const ry = y + h * 0.64 + i * rowGap
      return `<rect x="${lx}" y="${ry}" width="${width}" height="${rowH}" rx="${rowH / 2}" fill="${markFill}" opacity="${1 - i * 0.22}"/>`
    })
    .join('')
  return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${bodyFill}"/>
    <rect x="${lx}" y="${y + h * 0.12}" width="${lw}" height="${h * 0.42}" rx="${r * 0.5}" fill="${markFill}"/>
    ${rows}`
}

const svg = (size, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`

const purpleBg = (size) => `
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${PURPLE_LIGHT}"/><stop offset="100%" stop-color="${PURPLE}"/>
  </linearGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>`

async function write(path, size, body, resizeTo) {
  let img = sharp(Buffer.from(svg(size, body)))
  if (resizeTo) img = img.resize(resizeTo, resizeTo)
  await img.png().toFile(path)
  console.log(path)
}

const iconArt = (size) => purpleBg(size) + glyph(size, 1)
const splashArt = (size) => `<rect width="${size}" height="${size}" fill="${DARK}"/>` + glyph(size, 0.3)

// Sources for @capacitor/assets.
await write('assets/icon.png', 1024, iconArt(1024))
await write('assets/icon-background.png', 1024, purpleBg(1024))
await write('assets/icon-foreground.png', 1024, glyph(1024, 0.62)) // 66% safe zone
await write('assets/splash.png', 2732, splashArt(2732))
await write('assets/splash-dark.png', 2732, splashArt(2732))

// Home-screen icons for the installable web app.
for (const size of [192, 512]) {
  await write(`public/pwa-${size}.png`, 1024, iconArt(1024), size)
}
