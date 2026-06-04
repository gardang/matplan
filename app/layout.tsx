import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TabNav } from "@/components/TabNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Matplan",
  description: "Ukens middagsplan for familien",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Matplan" },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nb" className="h-full">
      <body
        className={`${inter.className} h-full bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 antialiased`}
      >
        <TabNav />
        <main className="max-w-2xl mx-auto px-4 pt-4 pb-24 lg:pb-8 lg:pt-20">
          {children}
        </main>
      </body>
    </html>
  );
}
