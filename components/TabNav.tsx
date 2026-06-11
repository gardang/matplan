"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ShoppingCart, MessageCircle, Settings, BarChart3 } from "lucide-react";

const tabs = [
  { href: "/plan", label: "Plan", Icon: CalendarDays },
  { href: "/shopping", label: "Handle", Icon: ShoppingCart },
  { href: "/innsikt", label: "Innsikt", Icon: BarChart3 },
  { href: "/chat", label: "Chat", Icon: MessageCircle },
  { href: "/settings", label: "Innstillinger", Icon: Settings },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex items-center justify-around px-2 pb-safe lg:hidden z-50">
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center rounded-lg px-3 transition-colors ${
                active
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop top nav */}
      <nav className="hidden lg:flex fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 h-14 items-center gap-1">
        <span className="font-semibold text-emerald-600 mr-6 text-base">🥘 Matplan</span>
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
