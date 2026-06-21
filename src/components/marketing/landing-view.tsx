"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Clock, MapPin, QrCode, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";

const features = [
  {
    icon: QrCode,
    title: "QR dynamique",
    desc: "Rotation toutes les 30 s, validation serveur anti-fraude.",
  },
  {
    icon: MapPin,
    title: "Géofencing GPS",
    desc: "Pointage autorisé uniquement dans la zone entreprise.",
  },
  {
    icon: Clock,
    title: "Entrées & sorties",
    desc: "Suivi automatique des horaires et historique employé.",
  },
  {
    icon: Users,
    title: "Congés & profils",
    desc: "Demandes, validation admin et profils employés complets.",
  },
  {
    icon: BarChart3,
    title: "Dashboard RH",
    desc: "Présents, absents, heures travaillées et anomalies.",
  },
  {
    icon: ShieldCheck,
    title: "Sécurité",
    desc: "Rôles admin/employé, Firebase Auth et règles Firestore.",
  },
];

export function LandingView() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-surface-page">
      <header className="sticky top-0 z-20 border-b border-brand/10 bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo size="md" />
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Connexion</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/register">Demander l&apos;accès</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-14 sm:px-6">
        <motion.section
          className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-brand/20 bg-brand-light/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-dark">
              Pointage numérique · PFA RH
            </span>
            <h1 className="font-heading text-4xl leading-[1.1] tracking-tight text-brand-dark sm:text-5xl">
              La présence de vos équipes,
              <span className="block text-brand">mesurée et sécurisée.</span>
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
              TimeTrack Pro centralise le pointage GPS + QR, la gestion des congés et les tableaux de bord pour les
              administrateurs RH — pensé pour le terrain et le bureau.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/login">
                  Se connecter
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/register">Rejoindre l&apos;entreprise</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-6 pt-2 text-sm text-muted-foreground">
              <span>
                <strong className="text-brand-dark">30 s</strong> QR rotatif
              </span>
              <span>
                <strong className="text-brand-dark">100 %</strong> validation serveur
              </span>
              <span>
                <strong className="text-brand-dark">Mobile</strong> first
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-brand/15 to-brand-light/30 blur-2xl" />
            <div className="relative rounded-2xl border border-brand/15 bg-card p-6 shadow-elevated">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-brand">Flux employé</p>
              <ol className="space-y-4">
                {["Activer le GPS", "Scanner le QR entrée", "Pointer entrée / sortie", "Consulter historique & congés"].map(
                  (step, i) => (
                    <li key={step} className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-brand-dark">{step}</span>
                    </li>
                  ),
                )}
              </ol>
            </div>
          </div>
        </motion.section>

        <section className="mt-20">
          <h2 className="mb-8 text-center font-heading text-2xl text-brand-dark">Fonctionnalités clés</h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-brand/10 bg-card p-5 shadow-card"
              >
                <div className="mb-3 inline-flex rounded-lg bg-brand-light p-2.5">
                  <Icon className="size-5 text-brand" aria-hidden />
                </div>
                <h3 className="font-heading text-base text-brand-dark">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </motion.li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-brand/10 bg-card/80 py-6 text-center text-xs text-muted-foreground">
        TimeTrack Pro — Système de pointage numérique des employés
      </footer>
    </div>
  );
}
