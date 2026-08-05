import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "InvoPilot — Smart Invoice Management",
  description: "Track payment status, revenue trends, and GST-ready summaries.",
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                if (e.message && (e.message.indexOf('Loading chunk') !== -1 || e.message.indexOf('Failed to load chunk') !== -1 || e.message.indexOf('ChunkLoadError') !== -1)) {
                  if (!sessionStorage.getItem('chunk_retry')) {
                    sessionStorage.setItem('chunk_retry', 'true');
                    window.location.reload();
                  }
                }
              });
              window.addEventListener('unhandledrejection', function(e) {
                if (e.reason && e.reason.message && (e.reason.message.indexOf('Loading chunk') !== -1 || e.reason.message.indexOf('Failed to load chunk') !== -1 || e.reason.message.indexOf('ChunkLoadError') !== -1)) {
                  if (!sessionStorage.getItem('chunk_retry')) {
                    sessionStorage.setItem('chunk_retry', 'true');
                    window.location.reload();
                  }
                }
              });
            `,
          }}
        />
      </head>
      <body className="min-h-full font-sans text-ink-900" suppressHydrationWarning>
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
