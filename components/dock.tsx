"use client";

import { useEffect, useState } from "react";

type Popup = { id: number; body: string; channel: string };

export function DemoDock({ userId, label, closeLabel }: { userId: number | null; label: string; closeLabel: string }) {
  const [items, setItems] = useState<Popup[]>([]);
  useEffect(() => {
    if (!userId) return;
    let stop = false;
    const tick = async () => {
      const res = await fetch(`/api/demo/popup?user=${userId}`);
      if (!res.ok || stop) return;
      const data = (await res.json()) as { items: Popup[] };
      if (data.items?.length) setItems(data.items);
    };
    const id = setInterval(tick, 4000);
    tick();
    return () => {
      stop = true;
      clearInterval(id);
    };
  }, [userId]);
  if (!items.length) return null;
  return (
    <div className="fixed inset-x-3 bottom-20 z-40 rounded-md border border-sea bg-white p-4 shadow-lg md:bottom-6 md:left-auto md:right-6 md:w-96">
      <p className="text-xs uppercase tracking-[0.14em] text-sea">{label}</p>
      {items.map((item) => (
        <p key={item.id} className="mt-2 text-sm">
          <span className="mr-2 text-xs uppercase text-gold">{item.channel}</span>
          {item.body}
        </p>
      ))}
      <button className="mt-3 min-h-11 underline" onClick={() => setItems([])} type="button">
        {closeLabel}
      </button>
    </div>
  );
}

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

export function Track({ event, params }: { event: string; params?: Record<string, string | number> }) {
  useEffect(() => {
    const layer = (window as Window & { dataLayer?: Record<string, unknown>[] });
    layer.dataLayer = layer.dataLayer || [];
    layer.dataLayer.push({ event, ...params });
  }, [event, params]);
  return null;
}
