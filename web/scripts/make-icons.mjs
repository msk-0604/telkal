// アイコン画像から favicon・アプリアイコンを生成する
//   node scripts/make-icons.mjs [元画像のパス]   （既定: assets/icon-source.png）
//
// 元画像のデザインは一切変更せず、四隅だけを角丸で透明にします（角を落とす）。
// 出力:
//   src/app/favicon.ico      … 16/32/48px（ブラウザのタブ）
//   src/app/icon.png         … 512px（/icon.png、ヘッダーのロゴにも使用）
//   src/app/apple-icon.png   … 180px（iPhone のホーム画面）
//   public/icon-192.png / public/icon-512.png … PWA マニフェスト用
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2] ?? join(root, "assets/icon-source.png");

/**
 * 元画像の角丸の半径を測る（一辺に対する割合）。
 * 左上の角から対角線上を進み、背景（白・透明）でなくなる位置 d を探す。
 * 半径 r の角丸は対角線上で d = r(1 - 1/√2) の位置に来るため、r = d / (1 - 1/√2)。
 */
async function detectRadiusRatio() {
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const size = Math.min(info.width, info.height);
  const isBackground = (x, y) => {
    const i = (y * info.width + x) * 4;
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    return a < 128 || (r > 200 && g > 200 && b > 200);
  };
  let d = 0;
  while (d < size / 2 && isBackground(d, d)) d++;
  const radius = d / (1 - Math.SQRT1_2);
  // 角のにじみ（白っぽい境界）を残さないよう 1% だけ大きめにとる
  return Math.min(0.5, radius / size + 0.01);
}

const RADIUS_RATIO = await detectRadiusRatio();

async function rounded(size) {
  const r = (size * RADIUS_RATIO).toFixed(2);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );
  return sharp(source)
    .resize(size, size, { fit: "cover", kernel: "lanczos3" })
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** PNG を埋め込んだ ICO を作る */
function toIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.buf)]);
}

function out(rel, buf) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
  console.log(`  ${rel} (${buf.length} bytes)`);
}

const meta = await sharp(source).metadata();
console.log(`元画像: ${source} (${meta.width}x${meta.height})、角丸の半径: 一辺の${(RADIUS_RATIO * 100).toFixed(1)}%`);
out("src/app/icon.png", await rounded(512));
out("public/icon-512.png", await rounded(512));
out("public/icon-192.png", await rounded(192));
// iOS は透過部分を黒く塗るため、角の外側を白で埋める（iOS 側でさらに角丸に切り抜かれる）
out(
  "src/app/apple-icon.png",
  await sharp(await rounded(180)).flatten({ background: "#ffffff" }).png().toBuffer(),
);
out("src/app/favicon.ico", toIco(await Promise.all([16, 32, 48].map(async (size) => ({ size, buf: await rounded(size) })))));
console.log("完了しました");
