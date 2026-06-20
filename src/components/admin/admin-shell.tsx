"use client";



import { useState } from "react";

import Link from "next/link";

import { usePathname } from "next/navigation";

import { signOut } from "firebase/auth";

import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

import { useAuth } from "@/components/providers/auth-provider";

import { getFirebaseAuth } from "@/lib/firebase-auth";

import { ThemeToggle } from "@/components/theme/theme-toggle";

import { BrandLogo } from "@/components/brand/brand-logo";



const items = [

  { href: "/admin/dashboard", label: "Dashboard" },

  { href: "/admin/employes", label: "Employés" },

  { href: "/admin/demandes", label: "Demandes" },

  { href: "/admin/conges", label: "Congés" },

  { href: "/admin/qr-code", label: "QR code" },

  { href: "/admin/parametres", label: "Paramètres" },

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



  const navLinkClass = (href: string) =>

    cn(

      "rounded-md px-3 py-2 text-sm font-medium transition-colors",

      pathname === href || (href !== "/admin/dashboard" && pathname?.startsWith(href))

        ? "bg-brand text-primary-foreground"

        : "text-muted-foreground hover:bg-brand-light/60 hover:text-brand-dark",

    );



  const Sidebar = (

    <aside className="admin-surface p-1.5 md:sticky md:top-[3.25rem] md:h-[calc(100dvh-4.25rem)] md:self-start">

      <nav className="flex flex-col gap-0.5">

        {items.map((it) => (

          <Link key={it.href} href={it.href} onClick={() => setMobileOpen(false)} className={navLinkClass(it.href)}>

            {it.label}

          </Link>

        ))}

      </nav>

    </aside>

  );



  return (

    <div className="min-h-dvh bg-background">

      <header className="sticky top-0 z-40 border-b border-brand/20 bg-card/95 backdrop-blur-sm">

        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">

          <div className="flex items-center gap-3">

            <button

              type="button"

              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-sm text-muted-foreground hover:bg-brand-light md:hidden"

              onClick={() => setMobileOpen(true)}

              aria-label="Ouvrir le menu admin"

            >

              ☰

            </button>

            <div className="flex items-center gap-2">

              <BrandLogo href="/admin/dashboard" />

              <span className="hidden font-heading text-sm text-brand-dark md:inline">Administration</span>

            </div>

          </div>

          <div className="flex items-center gap-2">

            <ThemeToggle />

            <div className="hidden max-w-[200px] truncate text-sm text-muted-foreground md:block">{user?.email}</div>

            <Button variant="outline" size="sm" onClick={handleLogout}>

              Déconnexion

            </Button>

          </div>

        </div>

      </header>



      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 md:grid-cols-[200px_1fr] md:gap-5 md:py-5">

        <div className="hidden md:block">{Sidebar}</div>

        <main className="min-w-0">{children}</main>

      </div>



      {mobileOpen ? (

        <div className="fixed inset-0 z-50 md:hidden">

          <button

            type="button"

            className="absolute inset-0 bg-brand-dark/50"

            onClick={() => setMobileOpen(false)}

            aria-label="Fermer le menu admin"

          />

          <div className="absolute left-0 top-0 h-full w-[min(300px,88vw)] border-r border-border bg-card p-4 shadow-xl">

            <div className="flex items-center justify-between">

              <div className="font-heading text-brand-dark">Menu</div>

              <button

                type="button"

                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-sm"

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


