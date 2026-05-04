"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase-auth";

const navItems = [
  { href: "/pointage", label: "Pointer" },
  { href: "/historique", label: "Historique" },
  { href: "/conges", label: "Congés" },
  { href: "/profil", label: "Profil" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, role } = useAuth();

  async function handleLogout() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-4">
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

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

