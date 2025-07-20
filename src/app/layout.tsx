import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AIChessProvidersProvider } from "@/lib/contexts/AIChessProviderContext";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI Chess Board",
  description: "A chess board with AI capabilities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} dark antialiased font-sans`}
      >
        <AIChessProvidersProvider>
          {children}
        </AIChessProvidersProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
