import type { Metadata, Viewport } from "next";
import { Noto_Sans_SC, Sora } from "next/font/google";
import "./globals.css";
import { Metrics } from "@/components/metrics";
import { BRAND } from "@/lib/brand";
import { getSettings } from "@/lib/settings";

const sora = Sora({ subsets: ["latin"], variable: "--font-sans" });
const noto = Noto_Sans_SC({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-zh" });

export async function generateMetadata(): Promise<Metadata> {
  const demo = getSettings().demo_mode;
  return {
    title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
    description: BRAND.tagline,
    robots: demo ? { index: false, follow: false } : { index: true, follow: true },
    applicationName: BRAND.name,
    appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: "#0c3d38",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${noto.variable}`}>
      <body className="font-sans antialiased" style={{ fontFamily: "var(--font-sans), var(--font-zh), sans-serif" }}>
        <Metrics />
        {children}
      </body>
    </html>
  );
}
