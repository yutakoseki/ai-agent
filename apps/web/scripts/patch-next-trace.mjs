import fs from "fs";
import path from "path";

/**
 * Amplify(Web Compute) で `.next` を解析して compute bundle を作るとき、
 * `.nft.json`(node-file-trace) の files リストに含まれていない依存は bundle から落ちる。
 *
 * Next.js 14.2.5 の App Router Route Handler は実行時に
 * `next/dist/compiled/next-server/app-route.runtime.prod.js`
 * を require するが、環境によって `.next/next-server.js.nft.json` 等に含まれず
 * Amplify 側で node_modules から欠落し、API が HTML 500 になることがある。
 *
 * このスクリプトは build 後に `.next/*server.js.nft.json` を補正する。
 */

const REQUIRED = [
  "node_modules/next/dist/compiled/next-server/app-route.runtime.prod.js",
  // 念のため（環境/ビルド差分で参照される可能性）
  "node_modules/next/dist/compiled/next-server/app-route.runtime.dev.js",
];

const NEXT_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(".next");
const TRACE_FILES = ["next-server.js.nft.json", "next-minimal-server.js.nft.json"];

function patchTrace(tracePath) {
  if (!fs.existsSync(tracePath)) return { tracePath, changed: false, reason: "missing" };
  const raw = fs.readFileSync(tracePath, "utf8");
  const json = JSON.parse(raw);
  if (!Array.isArray(json.files)) return { tracePath, changed: false, reason: "invalid-format" };

  const before = new Set(json.files);
  for (const rel of REQUIRED) {
    const abs = path.resolve(path.dirname(NEXT_DIR), rel);
    if (fs.existsSync(abs)) {
      // `.nft.json` は `.next` からの相対パスになっている想定
      json.files.push(path.posix.join("..", "..", "..", rel).replace(/\\/g, "/"));
    }
  }

  // 重複除去（順序はできるだけ維持）
  const seen = new Set();
  json.files = json.files.filter((f) => {
    if (seen.has(f)) return false;
    seen.add(f);
    return true;
  });

  const changed = json.files.length !== before.size;
  if (changed) {
    fs.writeFileSync(tracePath, JSON.stringify(json));
  }
  return { tracePath, changed, reason: "ok" };
}

let changedAny = false;
for (const name of TRACE_FILES) {
  const result = patchTrace(path.join(NEXT_DIR, name));
  if (result.changed) changedAny = true;
  // eslint-disable-next-line no-console
  console.log(
    `[patch-next-trace] ${path.basename(result.tracePath)}: ${result.reason}${
      result.changed ? " (patched)" : ""
    }`
  );
}

if (!changedAny) {
  // eslint-disable-next-line no-console
  console.log("[patch-next-trace] no changes");
}


