import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lentz TunerPro — Master Rimfire Barrel Harmonics',
  description: 'Precision .22 LR barrel tuner optimization platform by Lentz Precision Rifles. Live weather, Purdy Method 4 harmonics, thermal drift compensation, match day logging, and AI expert advisor. ARA • PSL • IR50/50.',
  icons: {
    icon: '/apple-touch-icon.jpg',
    apple: '/apple-touch-icon.jpg',
  },
  openGraph: {
    title: 'Lentz TunerPro — Precision Rimfire Barrel Harmonic Optimizer',
    description: 'The most advanced rimfire barrel tuner app for competitive benchrest shooters. Live weather, harmonic analysis, match logging, and AI ballistic advisor. Built for Lentz Precision Rifles.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 675,
        alt: 'Lentz TunerPro — Precision Rimfire Barrel Harmonic Optimizer',
      },
    ],
    type: 'website',
    siteName: 'Lentz TunerPro',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lentz TunerPro — Precision Rimfire Barrel Harmonic Optimizer',
    description: 'Live weather, Purdy Method 4, harmonic sweet spot analysis, match day logging, and AI ballistic advisor. Built for competitive .22 LR benchrest.',
    images: ['/og-image.jpg'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lentz TunerPro',
  },
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#08090C',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#08090C] text-neutral-100 min-h-screen antialiased selection:bg-sky-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
