import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TimeTrack Pro",
    template: "%s · TimeTrack Pro",
  },
  description:
    "SaaS professionnel de pointage numérique : présences en temps réel, GPS, QR code, congés et rapports RH.",
  keywords: ["pointage", "RH", "présence", "congés", "TimeTrack Pro"],
  authors: [{ name: "TimeTrack Pro" }],
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f6e56",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="light">
      <body suppressHydrationWarning className={`${inter.variable} ${plusJakarta.variable} min-h-dvh`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
