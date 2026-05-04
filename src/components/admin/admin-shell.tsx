"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";

const items = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/employes", label: "Employés" },
  { href: "/admin/conges", label: "Congés" },
  { href: "/admin/rapport-pointage", label: "Rapport pointage" },
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

  const Sidebar = (
    <aside className="rounded-lg border bg-card p-2 md:sticky md:top-20 md:h-[calc(100dvh-6rem)] md:self-start">
      <nav className="flex flex-col gap-1">
        {items.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              pathname === it.href && "bg-muted text-foreground",
            )}
          >
            {it.label}
          </Link>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-sm text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu admin"
            >
              ☰
            </button>
            <Link href="/admin/dashboard" className="font-semibold">
              Admin · TimeTrack Pro
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-sm text-muted-foreground md:block">{user?.email}</div>
            <Button variant="outline" onClick={handleLogout}>
              Se déconnecter
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <div className="hidden md:block">{Sidebar}</div>

        <main>{children}</main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer le menu admin"
          />
          <div className="absolute left-0 top-0 h-full w-[min(320px,90vw)] border-r bg-background p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Admin</div>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="mt-4">{Sidebar}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

