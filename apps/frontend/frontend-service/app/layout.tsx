import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./globals-height-responsive.css";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { GameModeProvider } from "@/src/contexts/GameModeContext";

// Roboto dentro il progetto invece che da Google Fonts: con next/font/google
// il build scaricava i font da Google e falliva quando Google rispondeva
// male (Railway, 24/11/2026: "Cannot read properties of null (reading '1')").
// File latin dal pacchetto @fontsource/roboto 5.2.5, licenza in fonts/roboto/OFL.txt.
const roboto = localFont({
  variable: "--font-roboto",
  display: "swap",
  src: [
    { path: "./fonts/roboto/roboto-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/roboto/roboto-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/roboto/roboto-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/roboto/roboto-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: {
    default: "Swipick - Football Prediction Game",
    template: "%s | Swipick"
  },
  description: "A speculative football game where you predict match outcomes and compete with friends",
  keywords: ["football", "prediction", "game", "sports", "betting", "fantasy"],
  authors: [{ name: "Swipick Team" }],
  creator: "Swipick",
  publisher: "Swipick",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Swipick",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "Swipick",
    title: "Swipick - Football Prediction Game",
    description: "A speculative football game where you predict match outcomes and compete with friends",
  },
  twitter: {
    card: "summary_large_image",
    title: "Swipick - Football Prediction Game",
    description: "A speculative football game where you predict match outcomes and compete with friends",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
        <meta name="theme-color" content="#22c55e" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Swipick" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      </head>
      <body
        className={`${roboto.variable} font-sans antialiased`}
      >
        <AuthProvider>
          <GameModeProvider>
            {children}
          </GameModeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
