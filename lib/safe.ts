/** Keep redirects on this site. Reject protocol-relative and backslash tricks. */
export function safePath(input: string, fallback = "/"): string {
  if (!input) return fallback;
  if (!input.startsWith("/") || input.startsWith("//") || input.startsWith("/\\") || input.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(input)) return fallback;
  try {
    const url = new URL(input, "http://ledirect.local");
    if (url.origin !== "http://ledirect.local") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

/** Site path only. Rejects protocol-relative URLs and parent traversal. */
export function safeAsset(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("..")) return null;
  if (/[\u0000-\u001f\s]/.test(value)) return null;
  return value;
}

/** A site path, or an https URL with no embedded credentials. */
export function safeMedia(value: string | null | undefined): string | null {
  const asset = safeAsset(value);
  if (asset) return asset;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function clampQty(value: number, allowZero = false): number {
  if (!Number.isFinite(value)) return allowZero ? 0 : 1;
  const n = Math.floor(value);
  if (allowZero && n <= 0) return 0;
  return Math.max(1, Math.min(99, n));
}
