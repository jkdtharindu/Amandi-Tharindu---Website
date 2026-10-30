import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";

// Clean, evenly spaced digits for the dashboard figures (see `.font-stat`).
const statFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-stat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Admin — Amandi & Tharindu",
  // The admin panel must never be indexed.
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${statFont.variable} min-h-screen bg-slate-100 text-slate-900`}>
      {children}
    </div>
  );
}
