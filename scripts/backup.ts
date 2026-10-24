import path from "path";
import { backupTree } from "../lib/backup";

const root = process.cwd();
const dir = backupTree({
  dbFile: process.env.DB_PATH || path.join(root, "data", "ledirect.sqlite"),
  uploadDir: path.join(root, "data", "uploads"),
  destRoot: path.join(root, "data", "backups"),
});
console.log(dir);
