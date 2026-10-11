import { formatWeddingDate } from "@/src/theme/formatWeddingDate.js";
import { createT } from "@/src/site-text/siteTextRegistry.js";

const DEFAULT_COUPLE_NAMES = "Amandi & Tharindu";
const DEFAULT_WEDDING_DATE = "2026-12-14";

/** Ports the `.page-footer` block from the prototype's `pageWrapper`. */
export default function PageFooter({
  coupleNames = DEFAULT_COUPLE_NAMES,
  weddingDate = DEFAULT_WEDDING_DATE,
  t = createT({}),
}: {
  coupleNames?: string;
  weddingDate?: string;
  t?: ReturnType<typeof createT>;
}) {
  return (
    <footer className="page-footer">
      <p>{t("footer.text", { weddingDate: formatWeddingDate(weddingDate), coupleNames })}</p>
    </footer>
  );
}
