import { createHmac } from "crypto";
import { existsSync } from "fs";
import path from "path";

const PALETTE = ["#0c3d38", "#16324f", "#3e4a38", "#6d4030", "#1c4554", "#3a342c"];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function shape(kind: string, ink: string, v: number): string {
  const shift = (v - 1) * 8;
  if (kind === "solar") {
    return `<g transform="translate(${shift},0)"><rect x="210" y="180" width="380" height="260" rx="8" fill="#dfe8ea" stroke="${ink}" stroke-width="8"/><path d="M210 245h380M210 310h380M210 375h380M305 180v260M400 180v260M495 180v260" stroke="${ink}" stroke-width="4" opacity=".55"/></g>`;
  }
  if (kind === "beauty") {
    return `<g transform="translate(${shift},0)"><ellipse cx="400" cy="390" rx="150" ry="170" fill="#f3e6dc" stroke="${ink}" stroke-width="8"/><path d="M250 300c40-120 260-120 300 0" fill="none" stroke="${ink}" stroke-width="10"/><circle cx="400" cy="250" r="18" fill="${ink}"/></g>`;
  }
  if (kind === "home") {
    return `<g transform="translate(${shift},0)"><path d="M300 220h200l30 70v230H270V290z" fill="#f4f7f6" stroke="${ink}" stroke-width="8"/><rect x="360" y="340" width="80" height="50" rx="6" fill="${ink}" opacity=".8"/></g>`;
  }
  if (kind === "moto") {
    return `<g transform="translate(${shift},0)"><path d="M250 360c40-140 260-150 300-10" fill="#e7eef0" stroke="${ink}" stroke-width="10"/><ellipse cx="400" cy="430" rx="120" ry="28" fill="${ink}" opacity=".15"/></g>`;
  }
  if (kind === "apparel") {
    return `<g transform="translate(${shift},0)"><path d="M280 230l120-40 120 40 70 60-60 40-40-30v220H310V300l-40 30-60-40z" fill="#f7f4ef" stroke="${ink}" stroke-width="8"/></g>`;
  }
  return `<g transform="translate(${shift},0)"><rect x="330" y="160" width="150" height="280" rx="22" fill="#f7f8f7" stroke="${ink}" stroke-width="8"/><rect x="365" y="200" width="80" height="140" rx="8" fill="${ink}" opacity=".12"/><path d="M220 470c40-30 80-30 120 0s80 30 140 0" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round"/></g>`;
}

export function packshotSvg(sku: string, category = "phone", variant = 1): string {
  const ink = PALETTE[hash(sku + category) % PALETTE.length];
  const v = ((variant - 1) % 3) + 1;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="${sku}">
  <rect width="800" height="800" fill="#e7efec"/>
  <ellipse cx="400" cy="620" rx="220" ry="28" fill="#0c3d38" opacity=".08"/>
  ${shape(category, ink, v)}
  <text x="40" y="760" fill="#5d726c" font-family="ui-sans-serif,sans-serif" font-size="18">${sku}</text>
</svg>`;
}

export function imageSet(sku: string, category: string, photo = false): string[] {
  const shots = [1, 2, 3].map((v) => `/art/${encodeURIComponent(sku)}?v=${v}&c=${category}`);
  if (!photo) return shots;
  const file = path.join(process.cwd(), "public", "photos", `${category}-${(hash(sku) % 3) + 1}.jpg`);
  if (existsSync(file)) shots[0] = `/photos/${path.basename(file)}`;
  return shots;
}

export function signBody(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}
