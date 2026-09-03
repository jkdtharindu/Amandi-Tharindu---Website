import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amandi & Tharindu",
  description:
    "Wedding website for Amandi Wijesundara and Tharindu Jayanetti — Monday, 14 December 2026.",
};

/**
 * Document shell only. The public wedding chrome (header/footer) lives in
 * `app/(public)/layout.tsx` so that `/admin` can render its own chrome
 * instead of the guest-facing one.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
