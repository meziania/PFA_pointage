"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu, QrCode, UserPlus, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/employes", label: "Employés", icon: Users },
  { href: "/admin/demandes", label: "Demandes", icon: UserPlus },
  { href: "/admin/qr-code", label: "QR", icon: QrCode },
] as const;

type Props = {
  onOpenMenu: () => void;
};

export function AdminMobileBottomNav({ onOpenMenu }: Props) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand/15 bg-card/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      aria-label="Navigation admin"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map((it) => {
          const active = pathname === it.href || pathname?.startsWith(`${it.href}/`);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={cn(
                  "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-medium transition-colors",
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
        <li>
          <button
            type="button"
            onClick={onOpenMenu}
            className="flex min-h-[3.25rem] w-full flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-medium text-muted-foreground"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-transparent">
              <Menu className="size-5" aria-hidden />
            </span>
            Menu
          </button>
        </li>
      </ul>
    </nav>
  );
}
