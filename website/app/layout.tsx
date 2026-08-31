import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Instrument_Sans,
  Martian_Mono,
} from "next/font/google";
import "./globals.css";
import "./landing.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans" });
const mono = Martian_Mono({ subsets: ["latin"], variable: "--font-mono" });

const SITE = process.env.NACHO_SITE_URL ?? "https://nacho.io";
// App Store Connect app id (adam id) — also used by eas submit.
const APP_STORE_ID = "6755894049";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "nacho — Own your internet address",
    template: "%s · nacho",
  },
  description:
    "Look up a nacho handle — verified on Bitcoin, self-custodial, yours forever.",
  applicationName: "nacho",
  // Smart App Banner: offers "Open in the nacho app" on iOS Safari.
  appleWebApp: { capable: true, title: "nacho" },
  other: { "apple-itunes-app": `app-id=${APP_STORE_ID}` },
  openGraph: {
    type: "website",
    siteName: "nacho",
    url: SITE,
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0c" },
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
