// Minimal zero-dependency .zip extractor (stored + deflate entries only) --
// enough to open the datapack zips the build and the GitHub artifacts
// produce. No zip64, no encryption.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const EOCD_SIG = 0x06054b50;
const CDFH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

export function extractZip(zipPath, destDir) {
  const buf = fs.readFileSync(zipPath);

  // Find End-Of-Central-Directory record (scan back past any zip comment).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(`${zipPath}: not a zip file (no EOCD record)`);

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16); // central directory offset

  let extracted = 0;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== CDFH_SIG) throw new Error(`${zipPath}: bad central directory entry at ${off}`);
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const lfhOff = buf.readUInt32LE(off + 42);
    const name = buf.subarray(off + 46, off + 46 + nameLen).toString('utf8');
    off += 46 + nameLen + extraLen + commentLen;

    if (name.includes('..')) continue; // path traversal guard
    const outPath = path.join(destDir, name);
    if (name.endsWith('/')) {
      fs.mkdirSync(outPath, { recursive: true });
      continue;
    }

    // Local file header gives the real data offset (its own name/extra sizes).
    if (buf.readUInt32LE(lfhOff) !== LFH_SIG) throw new Error(`${zipPath}: bad local header for ${name}`);
    const lNameLen = buf.readUInt16LE(lfhOff + 26);
    const lExtraLen = buf.readUInt16LE(lfhOff + 28);
    const dataStart = lfhOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    let data;
    if (method === 0) data = raw;
    else if (method === 8) data = zlib.inflateRawSync(raw);
    else throw new Error(`${zipPath}: unsupported compression method ${method} for ${name}`);

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, data);
    extracted++;
  }
  return extracted;
}
