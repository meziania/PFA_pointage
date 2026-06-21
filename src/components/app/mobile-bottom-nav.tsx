"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, History, ScanLine, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/pointage", label: "Pointer", icon: ScanLine },
  { href: "/historique", label: "Historique", icon: History },
  { href: "/conges", label: "Congés", icon: CalendarDays },
  { href: "/profil", label: "Profil", icon: UserCircle },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand/15 bg-card/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Navigation principale"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {items.map((it) => {
          const active = pathname === it.href || pathname?.startsWith(`${it.href}/`);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-brand" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl",
                    active ? "bg-brand-light text-brand" : "bg-transparent",
                  )}
                >
                  <it.icon className="size-5" aria-hidden />
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
