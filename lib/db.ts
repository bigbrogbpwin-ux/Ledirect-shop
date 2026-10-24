import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "fs";
import path from "path";
import { SEED_VERSION } from "./defaults";
import { seed } from "./seed";

const globalForDb = globalThis as unknown as {
  __ledb?: DatabaseSync;
  __seeded?: boolean;
  __seeding?: boolean;
};

const TABLES = [
  "uploads", "coupon_uses", "coupons", "live_products", "posts", "api_keys", "recon_lines", "recon_batches", "audit_logs", "settings", "fx_rates",
  "seller_apps", "wallet_txns", "wallets", "messages", "ticket_messages", "tickets", "container_lines",
  "containers", "quotes", "refunds", "payments", "order_events", "order_items", "orders", "payment_groups",
  "cart_items", "carts", "reviews", "variants", "products", "categories", "addresses", "pickup_points",
  "rate_limits", "sessions", "otp_codes", "staff", "users",
];

export type Sql = DatabaseSync;

export function wipeTables(db: Sql) {
  db.exec("PRAGMA foreign_keys = OFF");
  for (const table of TABLES) db.exec(`DELETE FROM ${table}`);
  db.exec("PRAGMA foreign_keys = ON");
}

function dbPath() {
  return process.env.DB_PATH || path.join(process.cwd(), "data", "ledirect.sqlite");
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  pickup_point_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login',
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  reset_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pickup_points (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  hours TEXT NOT NULL,
  city TEXT NOT NULL,
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  kind TEXT NOT NULL DEFAULT 'local',
  fee_sle INTEGER NOT NULL DEFAULT 0,
  phone TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  area TEXT NOT NULL,
  line TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  name_fr TEXT NOT NULL,
  blurb_en TEXT NOT NULL DEFAULT '',
  blurb_zh TEXT NOT NULL DEFAULT '',
  blurb_fr TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  zone TEXT NOT NULL,
  source TEXT NOT NULL,
  category_id INTEGER,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL DEFAULT '',
  title_fr TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_zh TEXT NOT NULL DEFAULT '',
  description_fr TEXT NOT NULL,
  highlights_en TEXT NOT NULL DEFAULT '[]',
  highlights_zh TEXT NOT NULL DEFAULT '[]',
  highlights_fr TEXT NOT NULL DEFAULT '[]',
  images TEXT NOT NULL DEFAULT '[]',
  weight_g INTEGER NOT NULL,
  length_cm INTEGER NOT NULL,
  width_cm INTEGER NOT NULL,
  height_cm INTEGER NOT NULL,
  purchase_cny_fen INTEGER NOT NULL,
  domestic_usd_cents INTEGER NOT NULL DEFAULT 0,
  wh_usd_cents INTEGER NOT NULL DEFAULT 0,
  dest_usd_cents INTEGER NOT NULL DEFAULT 0,
  duty_bps INTEGER NOT NULL DEFAULT 0,
  hs_code TEXT,
  hs_signed_by TEXT,
  needs_permit INTEGER NOT NULL DEFAULT 0,
  margin_bps INTEGER NOT NULL,
  marketing_price_sle INTEGER,
  local_market_sle INTEGER,
  local_market_source TEXT,
  local_market_date TEXT,
  stock INTEGER,
  sold_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  gate_measure INTEGER NOT NULL DEFAULT 0,
  gate_english INTEGER NOT NULL DEFAULT 0,
  gate_local INTEGER NOT NULL DEFAULT 0,
  gate_hs INTEGER NOT NULL DEFAULT 0,
  gate_compliance INTEGER NOT NULL DEFAULT 0,
  compliance_note TEXT,
  is_hot INTEGER NOT NULL DEFAULT 0,
  is_estimate INTEGER NOT NULL DEFAULT 0,
  shop_name TEXT,
  shop_years INTEGER,
  sales_count_src INTEGER,
  supplier_name TEXT,
  air_ok INTEGER NOT NULL DEFAULT 1,
  tags TEXT NOT NULL DEFAULT '',
  visual_key TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  sku TEXT NOT NULL,
  price_delta_sle INTEGER NOT NULL DEFAULT 0,
  stock INTEGER,
  weight_extra_g INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  body TEXT NOT NULL,
  reply TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS carts (
  id INTEGER PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id INTEGER,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY,
  cart_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  qty INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payment_groups (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  number TEXT UNIQUE NOT NULL,
  purpose TEXT NOT NULL,
  total_sle INTEGER NOT NULL,
  charged_sle INTEGER NOT NULL,
  method TEXT,
  status TEXT NOT NULL,
  external_ref TEXT UNIQUE,
  raw_json TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  group_id INTEGER,
  zone TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  exception TEXT,
  shipping_method TEXT NOT NULL,
  pickup_point_id INTEGER,
  address_json TEXT,
  recipient_json TEXT,
  freight_mode TEXT NOT NULL,
  fx_sle_per_usd_e4 INTEGER NOT NULL,
  fx_usd_cny_e4 INTEGER NOT NULL,
  fx_buffer_bps INTEGER NOT NULL,
  goods_sle INTEGER NOT NULL,
  intl_sle INTEGER NOT NULL,
  delivery_sle INTEGER NOT NULL,
  air_delta_sle INTEGER NOT NULL DEFAULT 0,
  total_sle INTEGER NOT NULL,
  buffer_sle INTEGER NOT NULL DEFAULT 0,
  wallet_sle INTEGER NOT NULL DEFAULT 0,
  pay_mode TEXT NOT NULL,
  deposit_sle INTEGER NOT NULL DEFAULT 0,
  balance_sle INTEGER NOT NULL DEFAULT 0,
  deposit_paid INTEGER NOT NULL DEFAULT 0,
  balance_paid INTEGER NOT NULL DEFAULT 0,
  balance_due_at TEXT,
  balance_proof TEXT,
  price_locked INTEGER NOT NULL DEFAULT 0,
  pickup_code TEXT,
  quote_id INTEGER,
  note TEXT,
  discount_sle INTEGER NOT NULL DEFAULT 0,
  coupon_code TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  product_id INTEGER,
  variant_id INTEGER,
  title TEXT NOT NULL,
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_sle INTEGER NOT NULL,
  unit_goods_sle INTEGER NOT NULL,
  unit_intl_sle INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  evidence_url TEXT,
  evidence_kind TEXT,
  actor TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  group_id INTEGER,
  order_id INTEGER,
  user_id INTEGER,
  purpose TEXT NOT NULL,
  method TEXT NOT NULL,
  amount_sle INTEGER NOT NULL,
  status TEXT NOT NULL,
  external_ref TEXT UNIQUE,
  raw_json TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refunds (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL,
  payment_id INTEGER,
  reason TEXT NOT NULL,
  rule TEXT NOT NULL,
  amount_sle INTEGER NOT NULL,
  item_id INTEGER,
  choice TEXT,
  status TEXT NOT NULL,
  requested_by TEXT,
  approver1 TEXT,
  approver2 TEXT,
  payout_ref TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  qty INTEGER NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  product_id INTEGER,
  title TEXT,
  price_sle INTEGER,
  goods_sle INTEGER,
  intl_sle INTEGER,
  valid_until TEXT,
  order_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS containers (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  week_label TEXT NOT NULL,
  status TEXT NOT NULL,
  target_cm3 INTEGER NOT NULL,
  rollover_count INTEGER NOT NULL DEFAULT 0,
  bl_no TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS container_lines (
  id INTEGER PRIMARY KEY,
  container_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL UNIQUE,
  cm3 INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY,
  number TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  order_id INTEGER,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  subject TEXT NOT NULL,
  sla_due_at TEXT,
  assignee_id INTEGER,
  created_at TEXT NOT NULL,
  first_response_at TEXT
);
CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  author_kind TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  images TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  channel TEXT NOT NULL,
  template_key TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL,
  popup INTEGER NOT NULL DEFAULT 0,
  order_id INTEGER,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE TABLE IF NOT EXISTS wallets (
  user_id INTEGER PRIMARY KEY,
  balance_sle INTEGER NOT NULL DEFAULT 0,
  frozen_sle INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS wallet_txns (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount_sle INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  frozen_after INTEGER NOT NULL,
  ref TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS seller_apps (
  id INTEGER PRIMARY KEY,
  shop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  category TEXT NOT NULL,
  city TEXT,
  doc_note TEXT,
  doc_url TEXT,
  status TEXT NOT NULL,
  commission_bps INTEGER,
  seller_code TEXT,
  reject_reason TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fx_rates (
  id INTEGER PRIMARY KEY,
  sle_per_usd_e4 INTEGER NOT NULL,
  usd_cny_e4 INTEGER NOT NULL,
  buffer_bps INTEGER NOT NULL,
  effective_at TEXT NOT NULL,
  entered_by TEXT,
  reviewed_by TEXT,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  slug TEXT,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL DEFAULT '',
  title_fr TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_zh TEXT NOT NULL DEFAULT '',
  body_fr TEXT NOT NULL,
  image TEXT,
  video TEXT,
  meta_json TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS live_products (
  id INTEGER PRIMARY KEY,
  post_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS recon_batches (
  id INTEGER PRIMARY KEY,
  filename TEXT,
  imported_by TEXT,
  created_at TEXT NOT NULL,
  matched INTEGER NOT NULL DEFAULT 0,
  exceptions INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS recon_lines (
  id INTEGER PRIMARY KEY,
  batch_id INTEGER NOT NULL,
  external_ref TEXT NOT NULL,
  amount_sle INTEGER NOT NULL,
  status TEXT NOT NULL,
  order_id INTEGER,
  note TEXT
);
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title_en TEXT NOT NULL,
  title_zh TEXT NOT NULL DEFAULT '',
  title_fr TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  value INTEGER NOT NULL,
  cap_sle INTEGER NOT NULL DEFAULT 0,
  min_sle INTEGER NOT NULL DEFAULT 0,
  zone TEXT NOT NULL DEFAULT 'any',
  max_uses INTEGER NOT NULL DEFAULT 0,
  used_count INTEGER NOT NULL DEFAULT 0,
  per_user INTEGER NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS coupon_uses (
  id INTEGER PRIMARY KEY,
  coupon_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  amount_sle INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS uploads (
  name TEXT PRIMARY KEY,
  visibility TEXT NOT NULL,
  user_id INTEGER,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_products_zone ON products(zone, status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id, id);
CREATE INDEX IF NOT EXISTS idx_cart_token ON carts(token);
`;

function migrate(db: Sql) {
  const has = (table: string, column: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((row) => row.name === column);
  const add = (table: string, column: string, ddl: string) => {
    if (!has(table, column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  };
  add("pickup_points", "kind", "kind TEXT NOT NULL DEFAULT 'local'");
  add("pickup_points", "fee_sle", "fee_sle INTEGER NOT NULL DEFAULT 0");
  add("pickup_points", "phone", "phone TEXT NOT NULL DEFAULT ''");
  add("orders", "discount_sle", "discount_sle INTEGER NOT NULL DEFAULT 0");
  add("orders", "coupon_code", "coupon_code TEXT");
  add("seller_apps", "reject_reason", "reject_reason TEXT");
  add("seller_apps", "reviewed_at", "reviewed_at TEXT");
  add("refunds", "payout_ref", "payout_ref TEXT");
}

export function getDb(): Sql {
  if (!globalForDb.__ledb) {
    mkdirSync(path.dirname(dbPath()), { recursive: true });
    const db = new DatabaseSync(dbPath());
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    db.exec(SCHEMA);
    globalForDb.__ledb = db;
  }
  const db = globalForDb.__ledb;
  migrate(db);
  if (globalForDb.__seeding) return db;
  if (!globalForDb.__seeded) {
    globalForDb.__seeding = true;
    try {
      const count = (db.prepare("SELECT COUNT(*) AS c FROM products").get() as { c: number }).c;
      const verRow = db.prepare("SELECT value FROM settings WHERE key = 'seed_version'").get() as
        | { value: string }
        | undefined;
      if (count > 0 && verRow?.value !== SEED_VERSION) wipeTables(db);
      const left = (db.prepare("SELECT COUNT(*) AS c FROM products").get() as { c: number }).c;
      if (left === 0) seed(db);
      globalForDb.__seeded = true;
    } finally {
      globalForDb.__seeding = false;
    }
  }
  return db;
}

export function one<T>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...(params as [])) as T | undefined;
}

export function many<T>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...(params as [])) as T[];
}

export function run(sql: string, ...params: unknown[]) {
  return getDb().prepare(sql).run(...(params as []));
}

export function insert(sql: string, ...params: unknown[]): number {
  const info = run(sql, ...params);
  return Number(info.lastInsertRowid);
}

export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const value = fn();
    db.exec("COMMIT");
    return value;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already closed */
    }
    throw error;
  }
}

export function resetDatabase() {
  const db = getDb();
  wipeTables(db);
  globalForDb.__seeding = true;
  try {
    seed(db);
  } finally {
    globalForDb.__seeding = false;
  }
}
