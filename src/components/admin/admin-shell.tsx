"use client";

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

  async function handleLogout() {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await signOut(auth);
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/admin/dashboard" className="font-semibold">
            Admin · TimeTrack Pro
          </Link>
          <div className="flex items-center gap-2">
            <div className="hidden text-sm text-muted-foreground md:block">{user?.email}</div>
            <Button variant="outline" onClick={handleLogout}>
              Se déconnecter
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-lg border bg-card p-2 md:sticky md:top-20 md:h-[calc(100dvh-6rem)] md:self-start">
          <nav className="flex flex-col gap-1">
            {items.map((it) => (
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
          </nav>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}

