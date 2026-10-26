/**
 * Storage Guardian - Windows Icon Generator
 * Generates official multi-resolution Windows ICO (16x16, 32x32, 48x48, 64x64, 128x128, 256x256)
 * Theme: Blue Security Shield with Storage Disk Sector
 */

import fs from 'fs';
import path from 'path';

function createIconEntry(width, height, size, offset) {
  const buf = Buffer.alloc(16);
  buf.writeUInt8(width === 256 ? 0 : width, 0);
  buf.writeUInt8(height === 256 ? 0 : height, 1);
  buf.writeUInt8(0, 2); // palette
  buf.writeUInt8(0, 3); // reserved
  buf.writeUInt16LE(1, 4); // color planes
  buf.writeUInt16LE(32, 6); // bpp
  buf.writeUInt32LE(size, 8); // size
  buf.writeUInt32LE(offset, 12); // offset
  return buf;
}

function createBmpIconImage(size) {
  const headerSize = 40;
  const pixelBytes = size * size * 4;
  const andMaskRowBytes = Math.ceil(size / 32) * 4;
  const andMaskBytes = andMaskRowBytes * size;
  const totalImageSize = headerSize + pixelBytes + andMaskBytes;

  const buf = Buffer.alloc(totalImageSize);

  // BITMAPINFOHEADER (40 bytes)
  buf.writeUInt32LE(40, 0); // biSize
  buf.writeInt32LE(size, 4); // biWidth
  buf.writeInt32LE(size * 2, 8); // biHeight (ICO specification requires height * 2)
  buf.writeUInt16LE(1, 12); // biPlanes
  buf.writeUInt16LE(32, 14); // biBitCount
  buf.writeUInt32LE(0, 16); // biCompression (BI_RGB)
  buf.writeUInt32LE(pixelBytes + andMaskBytes, 20); // biSizeImage
  buf.writeInt32LE(0, 24); // biXPelsPerMeter
  buf.writeInt32LE(0, 28); // biYPelsPerMeter
  buf.writeUInt32LE(0, 32); // biClrUsed
  buf.writeUInt32LE(0, 36); // biClrImportant

  // Draw icon pixels (from bottom row to top row in BMP)
  let pixelOffset = headerSize;
  const center = size / 2;
  const radius = size * 0.45;

  for (let y = 0; y < size; y++) {
    // Note: BMP is stored bottom-to-top, so real Y in standard coordinates is (size - 1 - y)
    const stdY = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = stdY - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let b = 0, g = 0, r = 0, a = 0;

      // Shield / Outer Rounded Hexagon / Disc
      if (dist <= radius) {
        // Main brand gradient: Blue (#2563EB to #1D4ED8)
        const t = (stdY / size);
        r = Math.floor(37 * (1 - t) + 29 * t);
        g = Math.floor(99 * (1 - t) + 78 * t);
        b = Math.floor(235 * (1 - t) + 216 * t);
        a = 255;

        // Outer highlight rim
        if (dist >= radius - Math.max(1, size * 0.08)) {
          r = Math.min(255, r + 40);
          g = Math.min(255, g + 40);
          b = 255;
        }

        // Inner Storage Disk Ring
        const diskDist = Math.sqrt(dx * dx + (dy + size * 0.05) * (dy + size * 0.05));
        const innerRadius = radius * 0.65;
        if (diskDist <= innerRadius) {
          // Disc background (Dark Slate #0F172A)
          r = 15;
          g = 23;
          b = 42;

          // Disk pie / sector in Green (#10B981) indicating safe storage
          const angle = Math.atan2(dy + size * 0.05, dx);
          if (angle > -0.5 && angle < 1.8) {
            r = 16;
            g = 185;
            b = 129;
          }

          // Center spindle (Silver #E2E8F0)
          if (diskDist <= innerRadius * 0.28) {
            r = 226;
            g = 232;
            b = 240;
          }
        }
      } else if (dist <= radius + 1) {
        // Anti-aliasing edge
        r = 37;
        g = 99;
        b = 235;
        a = 120;
      }

      buf.writeUInt8(b, pixelOffset);
      buf.writeUInt8(g, pixelOffset + 1);
      buf.writeUInt8(r, pixelOffset + 2);
      buf.writeUInt8(a, pixelOffset + 3);
      pixelOffset += 4;
    }
  }

  // AND mask (all zeros for 32-bit alpha channel)
  // Already allocated with 0s

  return buf;
}

export function generateMultiResIco() {
  const sizes = [16, 32, 48, 64, 128, 256];
  const images = sizes.map((s) => createBmpIconImage(s));

  // 1. ICO Header (6 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon type
  header.writeUInt16LE(sizes.length, 4); // number of images

  // 2. Directory Entries (16 bytes per image)
  let currentOffset = 6 + sizes.length * 16;
  const entries = [];
  for (let i = 0; i < sizes.length; i++) {
    const s = sizes[i];
    const imgSize = images[i].length;
    entries.push(createIconEntry(s, s, imgSize, currentOffset));
    currentOffset += imgSize;
  }

  return Buffer.concat([header, ...entries, ...images]);
}

// Generate to public/icon.ico and build/icon.ico
const root = process.cwd();
const publicDir = path.join(root, 'public');
const buildDir = path.join(root, 'build');

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

const icoBuffer = generateMultiResIco();
fs.writeFileSync(path.join(publicDir, 'icon.ico'), icoBuffer);
fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuffer);

console.log(`[SUCCESS] Generated valid Windows multi-resolution icon (16, 32, 48, 64, 128, 256):`);
console.log(`- ${path.join(publicDir, 'icon.ico')} (${icoBuffer.length} bytes)`);
console.log(`- ${path.join(buildDir, 'icon.ico')} (${icoBuffer.length} bytes)`);
