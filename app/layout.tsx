import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import FloatingLegalChat from "@/components/ai/FloatingLegalChat";
import AppShell from "@/components/layout/AppShell";
import { LegalWorkspaceProvider } from "@/context/LegalWorkspaceContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Radar juridico",
  description: "Novedades legales oficiales para revisar sin pasos tecnicos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LegalWorkspaceProvider>
          <AppShell>
            {children}
          </AppShell>
          <FloatingLegalChat />
        </LegalWorkspaceProvider>
      </body>
    </html>
  );
}
