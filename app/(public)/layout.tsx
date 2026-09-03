import type { ReactNode } from "react";
import SiteHeader from "@/components/public/SiteHeader";
import PageFooter from "@/components/public/PageFooter";

/**
 * Replaces the prototype's `pageWrapper(title, bodyContent, scripts)` helper
 * from src/server.js, for guest-facing pages only.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell">
      <SiteHeader />
      {children}
      <PageFooter />
    </div>
  );
}
