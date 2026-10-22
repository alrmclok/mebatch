import type { Metadata } from "next";
import { Nunito, Playfair_Display } from "next/font/google";
import "./globals.css";

const body = Nunito({ subsets: ["latin"], variable: "--font-body" });
const display = Playfair_Display({ subsets: ["latin"], style: ["italic"], weight: ["700"], variable: "--font-display" });

export const metadata: Metadata = { title: "MeBatch", description: "Share files or text with a short code. No account needed." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}