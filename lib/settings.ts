import { DEFAULT_SETTINGS, SEED_FX, type AppSettings } from "./defaults";
import { one, many } from "./db";
import type { Fx, FreightSettings } from "./pricing";

export function getSettings(): AppSettings {
  const rows = many<{ key: string; value: string }>("SELECT key, value FROM settings");
  const out = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const key = row.key as keyof AppSettings;
    if (!(key in DEFAULT_SETTINGS)) continue;
    const sample = DEFAULT_SETTINGS[key];
    if (typeof sample === "boolean") (out[key] as boolean) = row.value === "1" || row.value === "true";
    else if (typeof sample === "number") (out[key] as number) = Number(row.value);
    else (out[key] as string) = row.value;
  }
  return out;
}

export function freightOf(s: AppSettings = getSettings()): FreightSettings {
  return {
    seaUsdCentsPerCbm: s.sea_usd_cents_per_cbm,
    airUsdCentsPerKg: s.air_usd_cents_per_kg,
    gstDeductible: s.gst_deductible,
    gstBps: s.gst_bps,
    minPreorderCm3: s.min_preorder_cm3,
  };
}

export function activeFx(): Fx {
  const row = one<{ sle_per_usd_e4: number; usd_cny_e4: number; buffer_bps: number }>(
    "SELECT sle_per_usd_e4, usd_cny_e4, buffer_bps FROM fx_rates WHERE status = 'active' ORDER BY effective_at DESC, id DESC LIMIT 1",
  );
  if (!row) return { ...SEED_FX };
  return { slePerUsdE4: row.sle_per_usd_e4, usdCnyE4: row.usd_cny_e4, bufferBps: row.buffer_bps };
}
