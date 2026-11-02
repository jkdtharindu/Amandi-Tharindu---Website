/**
 * Shown the instant a guest taps "Invitation", while the server looks up their
 * card. Without this, nothing visibly happened until the database answered.
 * Static on purpose: it must appear immediately, so it reads no wording or
 * theme data of its own.
 */
export default function InvitationLoading() {
  return (
    <section className="hero-panel invitation-loading" role="status" aria-live="polite">
      <span className="invitation-loading-dot" aria-hidden="true" />
      <p>Opening your invitation…</p>
    </section>
  );
}
