import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://sandbox.helixqa.tech"),
  title: "Sandbox — test your next idea before you build",
  description: "Shape your idea, explore the market, and test your assumptions in a research-led business sandbox.",
  openGraph: {
    type: "website",
    url: "https://sandbox.helixqa.tech",
    siteName: "Sandbox",
    title: "Sandbox — test your next idea before you build",
    description: "Shape your idea, explore the market, and test your assumptions before you build.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Sandbox — put your next big idea to the test" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sandbox — test your next idea before you build",
    description: "Shape your idea, explore the market, and test your assumptions before you build.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
