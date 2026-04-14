import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter, SiteHeader } from './site-shell';

export const metadata: Metadata = {
  title: 'Bruno Advisory',
  description: 'Superfície pública institucional e intake do Bruno Advisory'
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
