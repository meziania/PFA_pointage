"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { CalendarDays, History, LogOut, Menu, ScanLine, UserCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { BrandLogo } from "@/components/brand/brand-logo";
import { NotificationsBell } from "@/components/app/notifications-bell";
import { ProfileRequiredBanner } from "@/components/app/profile-required-banner";
import { MobileBottomNav } from "@/components/app/mobile-bottom-nav";

const navItems = [
  { href: "/pointage", label: "Pointer", icon: ScanLine },
  { href: "/historique", label: "Historique", icon: History },
  { href: "/conges", label: "Congés", icon: CalendarDays },
  { href: "/profil", label: "Profil", icon: UserCircle },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, role, profilePhotoURL } = useAuth();
  const avatarSrc = profilePhotoURL ?? user?.photoURL ?? null;
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
  }

  const allNavItems = useMemo(() => {
    const base = [...navItems];
    if (role === "admin") base.push({ href: "/admin/dashboard", label: "Admin", icon: UserCircle });
    return base;
  }, [role]);

  function navClass(href: string) {
    const active = pathname === href || (href.startsWith("/admin") && pathname?.startsWith("/admin"));
    return cn("nav-pill inline-flex items-center gap-2", active ? "nav-pill-active" : "nav-pill-idle");
  }

  return (
    <div className="min-h-dvh bg-surface-page">
      <header className="sticky top-0 z-40 border-b border-brand/10 bg-card/90 shadow-sm backdrop-blur-md" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2">
            {role === "admin" ? (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand/15 bg-card text-brand-dark hover:bg-brand-light md:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Menu admin"
              >
                <Menu className="size-4" />
              </button>
            ) : null}
            <BrandLogo size="sm" />
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((it) => (
                <Link key={it.href} href={it.href} className={navClass(it.href)}>
                  <it.icon className="size-4" aria-hidden />
                  {it.label}
                </Link>
              ))}
              {role === "admin" ? (
                <Link href="/admin/dashboard" className={navClass("/admin/dashboard")}>
                  Admin
                </Link>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <NotificationsBell />
                <div className="hidden items-center gap-2 md:flex">
                  {avatarSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarSrc} alt="" className="h-8 w-8 rounded-full border-2 border-brand/20 object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-brand/20 bg-brand-light text-xs font-bold text-brand-dark">
                      {(user.displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="max-w-[160px] truncate text-sm text-muted-foreground">{user.displayName ?? user.email}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </Button>
              </>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/login">Connexion</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <ProfileRequiredBanner />

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button type="button" className="absolute inset-0 bg-brand-dark/40" onClick={() => setMobileOpen(false)} aria-label="Fermer" />
          <div className="absolute left-0 top-0 flex h-full w-[min(320px,90vw)] flex-col border-r border-brand/10 bg-card shadow-elevated">
            <div className="flex items-center justify-between border-b border-brand/10 p-4">
              <BrandLogo size="sm" />
              <button type="button" className="rounded-lg border p-2" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu">
                <X className="size-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-3">
              {allNavItems.map((it) => (
                <Link key={it.href} href={it.href} onClick={() => setMobileOpen(false)} className={navClass(it.href)}>
                  <it.icon className="size-4" aria-hidden />
                  {it.label}
                </Link>
              ))}
            </nav>
            {user ? (
              <div className="mt-auto border-t border-brand/10 p-4">
                <p className="truncate text-xs text-muted-foreground">{user.displayName ?? user.email}</p>
                <Button variant="outline" className="mt-3 w-full" onClick={handleLogout}>
                  Déconnexion
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <main
        className={cn(
          "mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 md:pb-6",
          pathname === "/pointage" ? "max-w-lg pb-mobile-nav-action md:pb-4" : "pb-mobile-nav",
        )}
      >
        {children}
      </main>

      <MobileBottomNav />
    </div>
  );
}
