export const SEED_VERSION = "4";

export const SEED_FX = { slePerUsdE4: 240_000, usdCnyE4: 71_500, bufferBps: 300 };

export const DEFAULT_SETTINGS = {
  sea_usd_cents_per_cbm: 16_000,
  air_usd_cents_per_kg: 850,
  gst_deductible: false,
  gst_bps: 1_500,
  min_preorder_cm3: 50_000,
  delivery_sle: 30,
  free_delivery_sle: 500,
  split_threshold_sle: 13_500,
  deposit_bps: 3_000,
  container_target_cm3: 6_000_000,
  unpaid_hold_hours: 2,
  deposit_hours: 72,
  demo_mode: true,
  whatsapp_down: false,
  show_trust_stats: true,
  webhook_secret: "demo-monime-secret",
  order_seq: 140,
  group_seq: 40,
  ticket_seq: 20,
  ga4_id: "",
  meta_pixel_id: "",
  bank_name: "Rokel Commercial Bank",
  bank_holder: "LeDirect Trading (SL) Ltd",
  bank_account: "001-2345678-90",
  bank_branch: "Siaka Stevens Street, Freetown",
  brand_name: "LeDirect",
};

export type AppSettings = typeof DEFAULT_SETTINGS;
