import type { Metadata } from "next";
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const dmSerif = DM_Serif_Display({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "InvoPilot — Smart Invoice Management",
  description: "Track payment status, revenue trends, and GST-ready summaries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-ink-900" suppressHydrationWarning>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
