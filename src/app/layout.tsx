import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lentz TunerPro — Master Rimfire Barrel Harmonics',
  description: 'Precision .22 LR barrel tuner optimization, target computer vision scanner, and harmonic sweet spot platform inspired by Jeremiah Lentz.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Lentz TunerPro',
  },
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
