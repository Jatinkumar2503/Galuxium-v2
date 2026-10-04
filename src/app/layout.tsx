import type { Metadata } from 'next';
import { BackgroundCanvas } from '@/components/canvas/BackgroundCanvas';
import './globals.css';

export const metadata: Metadata = {
  title: 'Galuxium Nexus V2 — AI Invoice Reconciliation & Compliance',
  description:
    'Autonomous AI-powered invoice reconciliation and GST compliance platform for Indian SMEs and accountants.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-warm-bg text-warm-charcoal antialiased">
      <body className="min-h-full flex flex-col font-sans selection:bg-warm-accent/20 selection:text-warm-charcoal relative">
        {/* Persistent 3D Canvas Layer */}
        <BackgroundCanvas />

        {/* Foreground Content */}
        <div className="relative z-10 min-h-screen flex flex-col">{children}</div>
      </body>
    </html>
  );
}
