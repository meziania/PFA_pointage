"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Settings,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { BrandLogo } from "@/components/brand/brand-logo";
import { AdminMobileBottomNav } from "@/components/admin/admin-mobile-bottom-nav";

const items = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/employes", label: "Employés", icon: Users },
  { href: "/admin/demandes", label: "Demandes", icon: UserPlus },
  { href: "/admin/conges", label: "Congés", icon: CalendarDays },
  { href: "/admin/qr-code", label: "QR code", icon: QrCode },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
  }

  function navLinkClass(href: string) {
    const active = pathname === href || (href !== "/admin/dashboard" && pathname?.startsWith(href));
    return cn("nav-pill flex items-center gap-2.5", active ? "nav-pill-active" : "nav-pill-idle");
  }

  const Sidebar = (
    <aside className="admin-surface p-2">
      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Administration</p>
      <nav className="flex flex-col gap-0.5">
        {items.map((it) => (
          <Link key={it.href} href={it.href} onClick={() => setMobileOpen(false)} className={navLinkClass(it.href)}>
            <it.icon className="size-4 shrink-0" aria-hidden />
            {it.label}
          </Link>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-dvh bg-surface-page">
      <header className="sticky top-0 z-40 border-b border-brand/10 bg-card/95 shadow-sm backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand/15 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Menu admin"
            >
              <Menu className="size-4" />
            </button>
            <BrandLogo href="/admin/dashboard" size="sm" />
            <span className="hidden font-heading text-sm text-brand-dark md:inline">Espace RH</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-[200px] truncate text-sm text-muted-foreground md:block">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:px-4 sm:py-5 md:grid-cols-[220px_1fr] md:gap-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
        <div className="hidden md:block">{Sidebar}</div>
        <main className="min-w-0 pb-mobile-nav md:pb-0">{children}</main>
      </div>

      <AdminMobileBottomNav onOpenMenu={() => setMobileOpen(true)} />

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-brand-dark/40" onClick={() => setMobileOpen(false)} aria-label="Fermer" />
          <div className="absolute left-0 top-0 h-full w-[min(280px,88vw)] border-r border-brand/10 bg-card p-4 shadow-elevated">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-heading text-brand-dark">Menu</span>
              <button type="button" className="rounded-lg border p-2" onClick={() => setMobileOpen(false)} aria-label="Fermer">
                <X className="size-4" />
              </button>
            </div>
            {Sidebar}
          </div>
        </div>
      ) : null}
    </div>
  );
}
