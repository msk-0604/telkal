// Node 側のパスワードハッシュ（src/crypto.ts と同じ形式）
import { execFileSync } from "node:child_process";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, 100000, 32, "sha256");
  return `pbkdf2$100000$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

/** SQL 文字列リテラル（シングルクォートをエスケープ） */
export function q(v) {
  if (v === null || v === undefined) return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

/** SQL を一時ファイルに書き出して D1 に実行する */
export function executeSql(statements, { remote = false } = {}) {
  const file = join(mkdtempSync(join(tmpdir(), "telkal-")), "script.sql");
  writeFileSync(file, statements.join("\n"));
  execFileSync("npx", ["wrangler", "d1", "execute", "telkal", remote ? "--remote" : "--local", "--file", file], {
    stdio: "inherit",
  });
}

export { randomUUID };
