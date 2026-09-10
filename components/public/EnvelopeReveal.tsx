/**
 * The ~2s invitation reveal that plays after a correct code (PRD §15,
 * requirement 3): the seal lifts, the flap opens, the card slides out, the
 * envelope fades and the card grows to fill the screen. Pure CSS — the
 * timeline lives in globals.css under `.envelope-*`, and SiteGate navigates
 * to the invitation page once it finishes.
 *
 * Colours come from the theme variables, so the envelope follows whatever the
 * Theme Editor has set rather than a fixed ivory/gold/burgundy.
 */

export type InvitationCardSettings = {
  templateUrl: string;
  nameTop: string;
  nameLeft: string;
  nameFontSize: string;
  nameColor: string;
};

export default function EnvelopeReveal({
  guestName,
  coupleNames,
  invitation,
}: {
  guestName: string;
  coupleNames: string;
  invitation: InvitationCardSettings;
}) {
  return (
    <div className="envelope-stage" role="status" aria-live="polite">
      <span className="sr-only">Opening your invitation…</span>
      <div className="envelope" aria-hidden="true">
        <div className="envelope-back" />
        <div className="envelope-card">
          {invitation.templateUrl ? (
            <div className="envelope-card-template">
              {/* An admin-supplied URL of any host, so next/image (which needs
                  each remote host allow-listed in next.config) does not fit. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={invitation.templateUrl} alt="" />
              <span
                className="envelope-card-name"
                style={{
                  top: invitation.nameTop,
                  left: invitation.nameLeft,
                  fontSize: invitation.nameFontSize,
                  color: invitation.nameColor,
                }}
              >
                {guestName}
              </span>
            </div>
          ) : (
            <div className="envelope-card-fallback">
              <p className="envelope-card-eyebrow">You are invited</p>
              <p className="envelope-card-couple">{coupleNames}</p>
              <span className="envelope-card-rule" />
              <p className="envelope-card-guest">{guestName}</p>
            </div>
          )}
        </div>
        <div className="envelope-front" />
        <div className="envelope-flap" />
        <div className="envelope-seal" />
      </div>
    </div>
  );
}
