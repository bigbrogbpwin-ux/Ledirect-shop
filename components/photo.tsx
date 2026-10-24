"use client";

import { useState } from "react";
import { safeMedia } from "@/lib/safe";

export function Photo({ src, alt, sku, cat }: { src: string; alt: string; sku?: string; cat?: string }) {
  const fallback = `/art/${encodeURIComponent(sku || "item")}?c=${encodeURIComponent(cat || "phone")}`;
  const [current, setCurrent] = useState(safeMedia(src) || fallback);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setCurrent(fallback)}
    />
  );
}
