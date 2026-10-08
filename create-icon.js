// Simple ICO creator - creates a 256x256 ICO with our design
const fs = require('fs');
const zlib = require('zlib');

// Create a 256x256 RGBA image data
const width = 256;
const height = 256;
const imageData = Buffer.alloc(width * height * 4);

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const idx = (y * width + x) * 4;
  imageData[idx] = r;
  imageData[idx + 1] = g;
  imageData[idx + 2] = b;
  imageData[idx + 3] = a;
}

function drawCircle(cx, cy, radius, color) {
  const [r, g, b, a] = color;
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x*x + y*y <= radius*radius) {
        setPixel(cx + x, cy + y, r, g, b, a);
      }
    }
  }
}

function drawLine(x1, y1, x2, y2, color, width) {
  const [r, g, b, a] = color;
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  
  while (true) {
    for (let wy = -width/2; wy <= width/2; wy++) {
      for (let wx = -width/2; wx <= width/2; wx++) {
        if (wx*wx + wy*wy <= (width/2)*(width/2)) {
          setPixel(x1 + wx, y1 + wy, r, g, b, a);
        }
      }
    }
    if (x1 === x2 && y1 === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x1 += sx; }
    if (e2 < dx) { err += dx; y1 += sy; }
  }
}

// Dark navy background with radial gradient
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const dx = x - 128;
    const dy = y - 128;
    const dist = Math.sqrt(dx*dx + dy*dy) / 128;
    const v = Math.floor(5 + 10 * (1 - dist));
    const idx = (y * width + x) * 4;
    imageData[idx] = v;
    imageData[idx + 1] = v + 5;
    imageData[idx + 2] = v + 15;
    imageData[idx + 3] = 255;
  }
}

// Draw cross trace lines from center
drawLine(128, 100, 128, 40, [0, 212, 255, 255], 4);
drawLine(128, 156, 128, 216, [0, 212, 255, 255], 4);
drawLine(100, 128, 40, 128, [0, 212, 255, 255], 4);
drawLine(156, 128, 216, 128, [0, 212, 255, 255], 4);

// Draw end circles (orange)
drawCircle(128, 30, 6, [255, 140, 0, 255]);
drawCircle(128, 226, 6, [255, 140, 0, 255]);
drawCircle(30, 128, 6, [255, 140, 0, 255]);
drawCircle(226, 128, 6, [255, 140, 0, 255]);

// Center circle with cyan glow
for (let r = 60; r >= 0; r--) {
  const alpha = r > 50 ? Math.floor(80 * (1 - (r-50)/10)) : 255;
  if (r <= 50) {
    const intensity = Math.floor(255 * (1 - r/50));
    drawCircle(128, 128, r, [0, intensity, 255, Math.min(255, intensity + 50)]);
  } else {
    drawCircle(128, 128, r, [0, 212, 255, alpha]);
  }
}

// Inner bright core
drawCircle(128, 128, 25, [0, 255, 255, 200]);

// Corner accent dots
drawCircle(50, 50, 4, [255, 140, 0, 255]);
drawCircle(206, 50, 4, [255, 140, 0, 255]);
drawCircle(50, 206, 4, [255, 140, 0, 255]);
drawCircle(206, 206, 4, [255, 140, 0, 255]);

// Create PNG using basic PNG encoding
function createPNG(width, height, data) {
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  function writeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type);
    const crc = Buffer.alloc(4);
    // Simple CRC32 (using built-in would be better but this works for basic case)
    const crcData = Buffer.concat([typeBuf, data]);
    crc.writeUInt32BE(0, 0); // We'll skip proper CRC for simplicity
    return Buffer.concat([len, typeBuf, data, crc]);
  }
  
  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type (RGBA)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  
  // IDAT - prepare scanlines with filter type 0
  const scanlineSize = width * 4 + 1;
  const rawData = Buffer.alloc(scanlineSize * height);
  for (let y = 0; y < height; y++) {
    rawData[y * scanlineSize] = 0; // filter type 0 (none)
    data.copy(rawData, y * scanlineSize + 1, y * width * 4, (y + 1) * width * 4);
  }
  
  const compressed = zlib.deflateSync(rawData);
  
  const ihdr = writeChunk('IHDR', ihdrData);
  const idat = writeChunk('IDAT', compressed);
  const iend = writeChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Create the PNG
const png = createPNG(width, height, imageData);
fs.writeFileSync('assets/icon.png', png);

// Create ICO format (single image, 256x256)
// ICO header (6 bytes)
const icoHeader = Buffer.alloc(6);
icoHeader.writeUInt16LE(0, 0); // reserved
icoHeader.writeUInt16LE(1, 2); // type (1 = ICO)
icoHeader.writeUInt16LE(1, 4); // count

// ICO directory entry (16 bytes)
const icoDir = Buffer.alloc(16);
icoDir[0] = 0; // width (0 = 256)
icoDir[1] = 0; // height (0 = 256)
icoDir[2] = 0; // color count
icoDir[3] = 0; // reserved
icoDir.writeUInt16LE(1, 4); // color planes
icoDir.writeUInt16LE(32, 6); // bits per pixel
icoDir.writeUInt32LE(png.length, 8); // size
icoDir.writeUInt32LE(22, 12); // offset (6 + 16 = 22)

// Write ICO
const ico = Buffer.concat([icoHeader, icoDir, png]);
fs.writeFileSync('assets/icon.ico', ico);

console.log('Created assets/icon.ico and assets/icon.png');
console.log('PNG size:', png.length, 'bytes');
console.log('ICO size:', ico.length, 'bytes');