import type { Metadata, Viewport } from 'next';
import dynamic from 'next/dynamic';
import { Plus_Jakarta_Sans, Outfit, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { CommandSearch } from '@/components/CommandSearch';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const AiAssistantDrawer = dynamic(
  () => import('@/components/AiAssistantDrawer').then((mod) => mod.AiAssistantDrawer),
  { ssr: false }
);

export const metadata: Metadata = {
  title: 'Brandicom Agency CRM',
  description:
    'Internal CRM for a marketing agency: clients, content, engagement, partners, finance, and Gemini assistant.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${outfit.variable} ${jetbrainsMono.variable}`}
    >
      <body className={plusJakartaSans.className}>
        {children}
        <CommandSearch />
        <AiAssistantDrawer />
      </body>
    </html>
  );
}
