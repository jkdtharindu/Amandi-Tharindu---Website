import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import SiteHeader from "@/components/public/SiteHeader";
import PageFooter from "@/components/public/PageFooter";

export const metadata: Metadata = {
  title: "Amandi & Tharindu",
  description:
    "Wedding website for Amandi Wijesundara and Tharindu Jayanetti — Monday, 14 December 2026.",
};

/**
 * Replaces the prototype's `pageWrapper(title, bodyContent, scripts)` helper
 * from src/server.js. Per-page <title> now comes from each route's own
 * `metadata` export rather than a wrapper argument.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell">
          <SiteHeader />
          {children}
          <PageFooter />
        </div>
      </body>
    </html>
  );
}
