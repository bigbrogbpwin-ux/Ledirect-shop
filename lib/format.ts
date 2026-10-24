export function le(n: number | null | undefined): string {
  const v = Math.round(Number(n || 0));
  return `Le ${v.toLocaleString("en-GB")}`;
}

export function usdFromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100).toLocaleString("en-GB")}.${String(abs % 100).padStart(2, "0")}`;
}

export function freetown(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Freetown",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
  }).format(d);
}

export function weekLabel(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Freetown",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const y = Number(get("year"));
  const m = Number(get("month"));
  const d = Number(get("day"));
  const wd = get("weekday");
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - (map[wd] ?? 0));
  return utc.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();
}

export function hoursBetween(a: string, b = new Date()): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600_000;
}

export function cm3ToCbm(cm3: number): string {
  return (cm3 / 1_000_000).toFixed(3);
}

export function normalizePhone(raw: string): string {
  let d = raw.trim().replace(/[\s()-]/g, "");
  if (d.startsWith("00")) d = `+${d.slice(2)}`;
  if (d.startsWith("0")) d = `+232${d.slice(1)}`;
  if (d.startsWith("232")) d = `+${d}`;
  if (!d.startsWith("+")) d = `+${d}`;
  if (!/^\+\d{8,15}$/.test(d)) throw new Error("Enter a full phone number, like 076 111 001.");
  return d;
}

export function offerHost(raw: string): { url: string; domain: string } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const ok = ["1688.com", "taobao.com", "tmall.com"].some((d) => host === d || host.endsWith(`.${d}`));
  if (!ok) return null;
  return { url: u.toString(), domain: host };
}

export function csvEscape(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cur);
      cur = "";
    } else if (c === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (c !== "\r") cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}
