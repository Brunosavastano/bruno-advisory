import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from './site-shell';

export const metadata: Metadata = {
  title: 'Savastano Advisory',
  description: 'Consultoria independente de valores mobiliários para pessoas físicas.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
