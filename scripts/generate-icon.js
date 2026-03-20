const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");
const os = require("os");

const SIZES = [16, 32, 48, 64, 128, 256];
const BG = "#080c0a";
const GREEN = "#00ff88";
const GLOW = "rgba(0, 255, 136, 0.3)";

function drawBlockyFace(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const s = size / 256; // scale factor

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);

  // Glow effect behind head
  ctx.shadowColor = GLOW;
  ctx.shadowBlur = 20 * s;

  // Head outline — rounded rectangle
  const headX = 28 * s;
  const headY = 32 * s;
  const headW = 200 * s;
  const headH = 192 * s;
  const radius = 24 * s;
  const lineW = Math.max(2, 8 * s);

  ctx.strokeStyle = GREEN;
  ctx.lineWidth = lineW;
  ctx.beginPath();
  ctx.moveTo(headX + radius, headY);
  ctx.lineTo(headX + headW - radius, headY);
  ctx.arcTo(headX + headW, headY, headX + headW, headY + radius, radius);
  ctx.lineTo(headX + headW, headY + headH - radius);
  ctx.arcTo(
    headX + headW,
    headY + headH,
    headX + headW - radius,
    headY + headH,
    radius,
  );
  ctx.lineTo(headX + radius, headY + headH);
  ctx.arcTo(headX, headY + headH, headX, headY + headH - radius, radius);
  ctx.lineTo(headX, headY + radius);
  ctx.arcTo(headX, headY, headX + radius, headY, radius);
  ctx.closePath();
  ctx.stroke();

  // Reset shadow for interior elements
  ctx.shadowBlur = 0;

  // Eyes — two solid squares
  const eyeSize = Math.max(2, 24 * s);
  const eyeY = 100 * s;
  const leftEyeX = 80 * s;
  const rightEyeX = 152 * s;

  ctx.fillStyle = GREEN;
  ctx.fillRect(leftEyeX, eyeY, eyeSize, eyeSize);
  ctx.fillRect(rightEyeX, eyeY, eyeSize, eyeSize);

  // Mouth — horizontal line
  const mouthY = 168 * s;
  const mouthX1 = 88 * s;
  const mouthX2 = 168 * s;
  const mouthLineW = Math.max(1, 6 * s);

  ctx.strokeStyle = GREEN;
  ctx.lineWidth = mouthLineW;
  ctx.beginPath();
  ctx.moveTo(mouthX1, mouthY);
  ctx.lineTo(mouthX2, mouthY);
  ctx.stroke();

  return canvas.toBuffer("image/png");
}

async function main() {
  // png-to-ico is ESM, dynamic import required
  const pngToIco = (await import("png-to-ico")).default;

  // Write PNGs to temp files (png-to-ico expects file paths)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "blocky-icon-"));
  const tmpFiles = SIZES.map((size) => {
    const buf = drawBlockyFace(size);
    const file = path.join(tmpDir, `icon-${size}.png`);
    fs.writeFileSync(file, buf);
    return file;
  });

  const icoBuffer = await pngToIco(tmpFiles);
  const outPath = path.join(__dirname, "..", "build", "icon.ico");
  fs.writeFileSync(outPath, icoBuffer);

  // Cleanup temp files
  tmpFiles.forEach((f) => fs.unlinkSync(f));
  fs.rmdirSync(tmpDir);

  console.log(
    `Icon written to ${outPath} (${icoBuffer.length} bytes, ${SIZES.length} sizes)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
