"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Clock, MapPin, QrCode, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LandingView() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background"
      />
      <header className="relative z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight text-foreground">TimeTrack Pro</span>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Connexion</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Demander à rejoindre</Link>
            </Button>
          </nav>
        </div>
      </header>
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-12 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:gap-16">
        <motion.div
          className="flex-1 space-y-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-sm font-medium text-primary">Pointage & RH — temps réel</p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Le pointage entreprise,{" "}
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              simple et sécurisé
            </span>
            .
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            GPS, QR code dynamique, congés, anomalies et tableaux de bord — base technique prête pour les phases
            auth, dashboard et modules métier.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/login">
                Accéder à l&apos;app
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/register">Demander à rejoindre</Link>
            </Button>
          </div>
        </motion.div>
        <motion.ul
          className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-1"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.08 } },
          }}
        >
          {[
            { icon: Clock, title: "Temps réel", desc: "WebSockets et notifications." },
            { icon: MapPin, title: "Géolocalisation", desc: "Zones autorisées et anti-fraude." },
            { icon: QrCode, title: "QR dynamique", desc: "Rotation quotidienne sécurisée." },
            { icon: Shield, title: "Rôles et audit", desc: "Admin / employé, journaux d’activité." },
          ].map(({ icon: Icon, title, desc }) => (
            <motion.li
              key={title}
              variants={{
                hidden: { opacity: 0, y: 12 },
                show: { opacity: 1, y: 0 },
              }}
              className="rounded-xl border border-border/80 bg-card/80 p-4 shadow-sm backdrop-blur-sm"
            >
              <Icon className="mb-2 size-8 text-primary" aria-hidden />
              <h2 className="font-semibold text-card-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </motion.li>
          ))}
        </motion.ul>
      </main>
    </div>
  );
}
