import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const svgPath = join(root, 'packages/desktop/assets/icon.svg');
const outDir = join(root, 'packages/desktop/assets');
const svg = readFileSync(svgPath);

// PNG 512 (main) + 256 (fallback display in some panels)
await sharp(svg).resize(512, 512).png().toFile(join(outDir, 'icon.png'));
console.log('wrote icon.png (512x512)');

// Build a multi-size .ico from raw PNG buffers
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = [];
for (const s of sizes) {
  const buf = await sharp(svg).resize(s, s).png().toBuffer();
  pngs.push({ size: s, buf });
}

// Minimal ICO writer (PNG-embedded entries — supported Vista+)
const ICONDIR_SIZE = 6;
const ICONDIRENTRY_SIZE = 16;
const header = Buffer.alloc(ICONDIR_SIZE);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);

let offset = ICONDIR_SIZE + ICONDIRENTRY_SIZE * pngs.length;
const entries = [];
const data = [];
for (const { size, buf } of pngs) {
  const e = Buffer.alloc(ICONDIRENTRY_SIZE);
  e.writeUInt8(size === 256 ? 0 : size, 0);
  e.writeUInt8(size === 256 ? 0 : size, 1);
  e.writeUInt8(0, 2); // palette
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // planes
  e.writeUInt16LE(32, 6); // bpp
  e.writeUInt32LE(buf.length, 8);
  e.writeUInt32LE(offset, 12);
  entries.push(e);
  data.push(buf);
  offset += buf.length;
}

const ico = Buffer.concat([header, ...entries, ...data]);
writeFileSync(join(outDir, 'icon.ico'), ico);
console.log(`wrote icon.ico (${pngs.length} sizes, ${ico.length} bytes)`);
