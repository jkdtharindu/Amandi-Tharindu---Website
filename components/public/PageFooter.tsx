import { formatWeddingDate } from "@/src/theme/formatWeddingDate.js";

const DEFAULT_COUPLE_NAMES = "Amandi & Tharindu";
const DEFAULT_WEDDING_DATE = "2026-12-14";

/** Ports the `.page-footer` block from the prototype's `pageWrapper`. */
export default function PageFooter({
  coupleNames = DEFAULT_COUPLE_NAMES,
  weddingDate = DEFAULT_WEDDING_DATE,
}: {
  coupleNames?: string;
  weddingDate?: string;
}) {
  return (
    <footer className="page-footer">
      <p>
        Wedding day: {formatWeddingDate(weddingDate)} · {coupleNames}&rsquo;s
        celebration website
      </p>
    </footer>
  );
}
