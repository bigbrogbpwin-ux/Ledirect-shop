"use client";

import { useState } from "react";

export function Photo({ src, alt, sku, cat }: { src: string; alt: string; sku?: string; cat?: string }) {
  const [current, setCurrent] = useState(src);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current}
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setCurrent(`/art/${encodeURIComponent(sku || "item")}?c=${cat || "phone"}`)}
    />
  );
}
