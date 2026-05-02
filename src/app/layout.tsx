import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans min-h-dvh`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
