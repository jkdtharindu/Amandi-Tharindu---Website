import { getSiteTextSafe } from "@/src/site-text/siteTextRepo.js";
import { createT } from "@/src/site-text/siteTextRegistry.js";

/** Two plain links under the countdown: Google Calendar, and a .ics file for everything else. */
export default async function AddToCalendar({ googleUrl }: { googleUrl: string }) {
  const t = createT(await getSiteTextSafe());
  return (
    <div className="add-to-calendar">
      <p className="add-to-calendar-title">{t("calendar.heading")}</p>
      <div className="add-to-calendar-buttons">
        <a className="button button-secondary" href={googleUrl} target="_blank" rel="noreferrer">
          {t("calendar.google")}
        </a>
        <a className="button button-secondary" href="/api/calendar" download="wedding.ics">
          {t("calendar.ics")}
        </a>
      </div>
    </div>
  );
}
