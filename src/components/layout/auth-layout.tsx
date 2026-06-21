import Link from "next/link";
import { Clock, MapPin, QrCode, Users } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

type AuthLayoutProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const highlights = [
  { icon: QrCode, label: "QR dynamique sécurisé" },
  { icon: MapPin, label: "Géofencing GPS" },
  { icon: Clock, label: "Entrées / sorties" },
  { icon: Users, label: "Espace RH & congés" },
];

export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-dark text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,110,86,0.45),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(225,245,238,0.12),transparent_45%)]" />
        <div className="relative z-10 p-10" style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top))" }}>
          <BrandLogo href="/" size="lg" className="[&_.font-heading]:text-white [&_.text-brand]:text-brand-light" />
          <div className="mt-12 max-w-md space-y-4">
            <p className="text-sm font-medium uppercase tracking-widest text-brand-light/80">Pointage numérique</p>
            <h1 className="font-heading text-3xl leading-tight tracking-tight">
              Gérez les présences de votre équipe avec précision et sécurité.
            </h1>
            <p className="text-sm leading-relaxed text-white/75">
              TimeTrack Pro combine scan QR, validation GPS et tableaux de bord RH pour un suivi fiable des employés.
            </p>
          </div>
        </div>
        <ul className="relative z-10 grid grid-cols-2 gap-3 p-10 pt-0">
          {highlights.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm">
              <Icon className="size-4 text-brand-light" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex flex-col items-center justify-center bg-surface-page px-3 py-6 sm:px-4 sm:py-10" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))", paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
        <div className="mb-8 lg:hidden">
          <BrandLogo size="lg" />
        </div>
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-1 text-center lg:text-left">
            <h2 className="font-heading text-2xl text-brand-dark">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-2xl border border-brand/15 bg-card p-6 shadow-card">{children}</div>
          {footer}
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:text-brand hover:underline">
              Retour à l&apos;accueil
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
