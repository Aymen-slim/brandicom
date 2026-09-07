import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AiAssistantDrawer } from '@/components/AiAssistantDrawer';
import { CommandSearch } from '@/components/CommandSearch';

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
    <html lang="en">
      <body>
        {children}
        <CommandSearch />
        <AiAssistantDrawer />
      </body>
    </html>
  );
}
