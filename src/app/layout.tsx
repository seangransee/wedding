import type { Metadata } from "next";
import { Cormorant_Garamond, Libre_Baskerville, Lora, Dancing_Script } from "next/font/google";
import "./globals.css";

const primarySerif = Cormorant_Garamond({
  variable: "--font-geist-sans",
  weight: ["400", "600"],
  subsets: ["latin"],
});

const secondarySerif = Libre_Baskerville({
  variable: "--font-geist-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const supportSerif = Lora({
  variable: "--font-support-serif",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const dancingScript = Dancing_Script({
  variable: "--font-dancing-script",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sexi Wedding",
  description: "Sean + Lexi = Sexi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
      </head>
      <body
        className={`${primarySerif.variable} ${secondarySerif.variable} ${supportSerif.variable} ${dancingScript.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
