// Gera os ícones PNG do PWA sem dependências (rasterização própria + zlib)
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const SS = 4
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size)
        r += pr * pa; g += pg * pa; b += pb * pa; a += pa
      }
      const o = y * (size * 4 + 1) + 1 + x * 4
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0
      raw[o + 3] = (a / (SS * SS)) * 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ])
}

const A = [139, 124, 246], B = [244, 114, 182]
const mix = (t) => A.map((v, i) => v + (B[i] - v) * t)
const segDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}
const CHECK = [[0.29, 0.52], [0.44, 0.665], [0.72, 0.36]]
const inCheck = (u, v, scale, w) => {
  const cu = 0.5 + (u - 0.5) / scale, cv = 0.5 + (v - 0.5) / scale
  return Math.min(
    segDist(cu, cv, ...CHECK[0], ...CHECK[1]),
    segDist(cu, cv, ...CHECK[1], ...CHECK[2]),
  ) < w / 2
}
const inRounded = (u, v, r) => {
  const qx = Math.max(Math.abs(u - 0.5) - (0.5 - r), 0)
  const qy = Math.max(Math.abs(v - 0.5) - (0.5 - r), 0)
  return Math.hypot(qx, qy) <= r
}

const icon = ({ rounded, scale }) => (u, v) => {
  if (rounded && !inRounded(u, v, 0.23)) return [0, 0, 0, 0]
  if (inCheck(u, v, scale, 0.095)) return [255, 255, 255, 1]
  return [...mix((u + v) / 2), 1]
}
const badge = (u, v) => (inCheck(u, v, 1.25, 0.12) ? [255, 255, 255, 1] : [0, 0, 0, 0])

writeFileSync('public/icon-192.png', png(192, icon({ rounded: true, scale: 1 })))
writeFileSync('public/icon-512.png', png(512, icon({ rounded: true, scale: 1 })))
writeFileSync('public/icon-maskable-512.png', png(512, icon({ rounded: false, scale: 0.78 })))
writeFileSync('public/apple-touch-icon.png', png(180, icon({ rounded: false, scale: 0.9 })))
writeFileSync('public/badge-96.png', png(96, badge))
writeFileSync(
  'public/favicon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b7cf6"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs><rect width="100" height="100" rx="23" fill="url(#g)"/><path d="M29 52 44 66.5 72 36" fill="none" stroke="#fff" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
)
console.log('ícones gerados em /public')
