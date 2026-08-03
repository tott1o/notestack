const fs = require('fs');
const path = require('path');

const srcPngPath = path.join(__dirname, 'notestacklogo.png');
const targetIcoRoot = path.join(__dirname, 'notestacklogo.ico');
const targetIcoPublic = path.join(__dirname, 'public/notestacklogo.ico');

if (!fs.existsSync(srcPngPath)) {
  console.error('Source notestacklogo.png not found!');
  process.exit(1);
}

const pngBuf = fs.readFileSync(srcPngPath);

// Standard Windows ICO Header wrapping PNG stream
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // Reserved
header.writeUInt16LE(1, 2); // ICO format type
header.writeUInt16LE(1, 4); // 1 frame count

const dirEntry = Buffer.alloc(16);
dirEntry.writeUInt8(0, 0); // Width 256px
dirEntry.writeUInt8(0, 1); // Height 256px
dirEntry.writeUInt8(0, 2); // Colors
dirEntry.writeUInt8(0, 3); // Reserved
dirEntry.writeUInt16LE(1, 4); // Planes
dirEntry.writeUInt16LE(32, 6); // Bits per pixel
dirEntry.writeUInt32LE(pngBuf.length, 8); // Size of image data
dirEntry.writeUInt32LE(22, 12); // Offset to image data (6 + 16 = 22)

const icoBuf = Buffer.concat([header, dirEntry, pngBuf]);

fs.writeFileSync(targetIcoRoot, icoBuf);
fs.writeFileSync(targetIcoPublic, icoBuf);

console.log('Successfully created Windows compliant ICO icon:', icoBuf.length, 'bytes');
