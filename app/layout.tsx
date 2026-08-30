import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amandi & Tharindu — Wedding Website',
  description: 'Join us for our wedding celebration on December 14, 2026',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
