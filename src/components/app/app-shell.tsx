"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const navItems = [
  { href: "/pointage", label: "Pointer" },
  { href: "/historique", label: "Historique" },
  { href: "/conges", label: "Congés" },
  { href: "/profil", label: "Profil" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
  }

  const allNavItems = useMemo(() => {
    const base = [...navItems];
    if (role === "admin") base.push({ href: "/admin/dashboard", label: "Admin" });
    return base;
  }, [role]);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-sm text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              ☰
            </button>
            <Link href="/" className="font-semibold">
              TimeTrack Pro
            </Link>
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                    pathname === it.href && "bg-muted text-foreground",
                  )}
                >
                  {it.label}
                </Link>
              ))}
              {role === "admin" ? (
                <Link
                  href="/admin/dashboard"
                  className={cn(
                    "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                    pathname?.startsWith("/admin") && "bg-muted text-foreground",
                  )}
                >
                  Admin
                </Link>
              ) : null}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <div className="hidden text-sm text-muted-foreground md:block">
                  {user.displayName ?? user.email}
                </div>
                <Button variant="outline" onClick={handleLogout}>
                  Se déconnecter
                </Button>
              </>
            ) : (
              <Button asChild variant="outline">
                <Link href="/login">Se connecter</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu"
          />
          <div className="absolute left-0 top-0 h-full w-[min(320px,90vw)] border-r bg-background p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Menu</div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Fermer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1">
              {allNavItems.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                    pathname === it.href && "bg-muted text-foreground",
                    it.href.startsWith("/admin") && pathname?.startsWith("/admin") && "bg-muted text-foreground",
                  )}
                >
                  {it.label}
                </Link>
              ))}
            </div>

            {user ? (
              <div className="mt-4 border-t pt-4">
                <div className="text-xs text-muted-foreground">{user.displayName ?? user.email}</div>
                <Button variant="outline" className="mt-3 w-full" onClick={handleLogout}>
                  Se déconnecter
                </Button>
              </div>
            ) : (
              <div className="mt-4 border-t pt-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    Se connecter
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

