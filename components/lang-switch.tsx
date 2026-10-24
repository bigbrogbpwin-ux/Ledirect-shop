"use client";

import { usePathname } from "next/navigation";
import { LANGS, type Lang } from "@/lib/i18n";

export function LangSwitch({ lang }: { lang: Lang }) {
  const path = usePathname() || "/";
  return (
    <div className="flex gap-1">
      {LANGS.map((item) => (
        <a
          key={item.id}
          href={`/api/lang?lang=${item.id}&next=${encodeURIComponent(path)}`}
          className={`min-h-11 px-2 text-xs leading-[44px] ${lang === item.id ? "font-semibold underline" : "opacity-70"}`}
        >
          {item.label}
        </a>
      ))}
    </div>
  );
}
