import type { Metadata } from "next";
import { LandingView } from "@/components/marketing/landing-view";

export const metadata: Metadata = {
  title: "Accueil",
  description:
    "TimeTrack Pro — pointage numérique, géolocalisation, QR code, congés et rapports pour les équipes RH.",
};

export default function HomePage() {
  return <LandingView />;
}
