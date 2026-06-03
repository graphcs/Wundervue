import type { Metadata } from "next";
import localFont from "next/font/local";
import { Header } from "@/components/header/Header";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { OnboardingModal } from "@/components/auth/OnboardingModal";
import { SavedEventsPanel } from "@/components/account/SavedEventsPanel";
import { SavedVenuesPanel } from "@/components/account/SavedVenuesPanel";
import { UpgradeModal } from "@/components/account/UpgradeModal";
import { ManageSubscriptionModal } from "@/components/account/ManageSubscriptionModal";
import "./globals.css";

const omnes = localFont({
  src: [
    { path: "../public/fonts/Omnes_Light.woff", weight: "300", style: "normal" },
    { path: "../public/fonts/Omnes_Light_Italic.woff", weight: "300", style: "italic" },
    { path: "../public/fonts/Omnes_Regular.woff", weight: "400", style: "normal" },
    { path: "../public/fonts/Omnes_Italic.woff", weight: "400", style: "italic" },
    { path: "../public/fonts/Omnes_Medium.woff", weight: "500", style: "normal" },
    { path: "../public/fonts/Omnes_Medium_Italic.woff", weight: "500", style: "italic" },
    { path: "../public/fonts/Omnes_Bold.woff", weight: "700", style: "normal" },
    { path: "../public/fonts/Omnes_Bold_Italic.woff", weight: "700", style: "italic" },
    { path: "../public/fonts/Omnes_Black.woff", weight: "900", style: "normal" },
    { path: "../public/fonts/Omnes_Black_Italic.woff", weight: "900", style: "italic" },
  ],
  variable: "--font-omnes",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Wundervue — Denver events & deals",
    template: "%s | Wundervue",
  },
  description:
    "Discover the best events, deals, and things to do in Denver. Find concerts, food & drink, markets, outdoor adventures, and exclusive local offers.",
};

export default function RootLayout({
  children,
  panel,
}: Readonly<{
  children: React.ReactNode;
  panel: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${omnes.variable} h-full antialiased`}>
      <body className="bg-bg text-dark min-h-full flex flex-col font-sans">
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          {panel}
          <OnboardingModal />
          <SavedEventsPanel />
          <SavedVenuesPanel />
          <UpgradeModal />
          <ManageSubscriptionModal />
        </AuthProvider>
      </body>
    </html>
  );
}
