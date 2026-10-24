import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

function quotePath(file: string) {
  return file.replaceAll("'", "''");
}

export function backupTree(input: { dbFile: string; uploadDir: string; destRoot: string }) {
  if (!existsSync(input.dbFile)) throw new Error("Database file is missing.");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(input.destRoot, stamp);
  mkdirSync(dir, { recursive: true });
  const target = path.join(dir, "ledirect.sqlite");
  const db = new DatabaseSync(input.dbFile);
  try {
    db.exec(`VACUUM INTO '${quotePath(target)}'`);
  } finally {
    db.close();
  }
  if (existsSync(input.uploadDir)) cpSync(input.uploadDir, path.join(dir, "uploads"), { recursive: true });
  prune(input.destRoot);
  return dir;
}

export function restoreTree(input: { backupDir: string; dbFile: string; uploadDir: string }) {
  const source = path.join(input.backupDir, "ledirect.sqlite");
  if (!existsSync(source)) throw new Error("Backup database is missing.");
  mkdirSync(path.dirname(input.dbFile), { recursive: true });
  cpSync(source, input.dbFile);
  for (const suffix of ["-wal", "-shm"]) {
    const side = `${input.dbFile}${suffix}`;
    if (existsSync(side)) rmSync(side);
  }
  rmSync(input.uploadDir, { recursive: true, force: true });
  const uploads = path.join(input.backupDir, "uploads");
  if (existsSync(uploads)) cpSync(uploads, input.uploadDir, { recursive: true });
  else mkdirSync(input.uploadDir, { recursive: true });
}

function prune(destRoot: string) {
  const cutoff = Date.now() - KEEP_MS;
  for (const name of readdirSync(destRoot)) {
    const full = path.join(destRoot, name);
    if (!statSync(full).isDirectory()) continue;
    if (statSync(full).mtimeMs < cutoff) rmSync(full, { recursive: true, force: true });
  }
}

export function latestBackup(destRoot: string): string | null {
  if (!existsSync(destRoot)) return null;
  const dirs = readdirSync(destRoot)
    .map((name) => path.join(destRoot, name))
    .filter((full) => statSync(full).isDirectory())
    .sort();
  return dirs.at(-1) || null;
}
