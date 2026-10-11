/**
 * Every piece of wording a guest can see that the admin may change (Action 81
 * part B, slice 2). Each entry is the key the code asks for, the group it is
 * shown under in Admin > Site wording, a plain-language label, and the default
 * text — which is exactly the wording the site had before this existed, so a
 * site with nothing edited looks the same as it always did.
 *
 * Wording can contain {tags} such as {coupleNames}; the site fills them in
 * (names, dates, a guest's name). Only the tags listed for an entry are filled.
 *
 * Pure data and one helper, no database import, so client components can use it.
 */

export const SITE_TEXT_GROUPS = [
  'Menu',
  'Home — top banner',
  'Home — countdown',
  'Home — Our Story',
  'Home — The couple',
  'Home — Wedding events',
  'Home — Gallery',
  'Home — FAQ',
  'Home — Wishes',
  'Footer',
  'Sign-in page',
  'Invitation page',
  'RSVP — who is coming',
  'RSVP — messages',
  'RSVP — single answer (older invitations)',
];

const ACCEPTED_TAGS = {
  couple: '{coupleNames}',
  date: '{weddingDate}',
  guest: '{guestName}',
};

/** @type {[string, string, string, string, { multiline?: boolean, tags?: string[] }?][]} */
// [key, group, label, default text, options]
const ROWS = [
  // Menu
  ['menu.home', 'Menu', 'Menu: Home', 'Home'],
  ['menu.ourStory', 'Menu', 'Menu: Our Story', 'Our Story'],
  ['menu.familyDetails', 'Menu', 'Menu: Family Details', 'Family Details'],
  ['menu.eventDetails', 'Menu', 'Menu: Event Details', 'Event Details'],
  ['menu.gallery', 'Menu', 'Menu: Gallery', 'Gallery'],
  ['menu.wishes', 'Menu', 'Menu: Wishes', 'Wishes'],
  ['menu.invitation', 'Menu', 'Menu: Invitation', 'Invitation'],

  // Home — top banner
  ['hero.flag', 'Home — top banner', 'Small line above the heading', 'Save the date — {weddingDate}', { tags: [ACCEPTED_TAGS.date] }],
  ['hero.heading', 'Home — top banner', 'Main heading', 'Join us for a celebration of love, family, and new beginnings.', { multiline: true }],
  [
    'hero.intro',
    'Home — top banner',
    'Welcome paragraph',
    'Welcome to the wedding website for {coupleNames}. Discover our story, event details, gallery, wishes, and access your personalized invitation.',
    { multiline: true, tags: [ACCEPTED_TAGS.couple] },
  ],
  ['hero.buttonInvitation', 'Home — top banner', 'Button: open invitation', 'View Your Invitation'],
  ['hero.buttonStory', 'Home — top banner', 'Button: our story', 'Our Story'],

  // Home — countdown
  ['countdown.days', 'Home — countdown', 'Countdown: Days', 'Days'],
  ['countdown.hours', 'Home — countdown', 'Countdown: Hours', 'Hours'],
  ['countdown.minutes', 'Home — countdown', 'Countdown: Minutes', 'Minutes'],
  ['countdown.seconds', 'Home — countdown', 'Countdown: Seconds', 'Seconds'],

  // Home — Our Story
  ['story.flag', 'Home — Our Story', 'Small label', 'Our story'],
  ['story.heading', 'Home — Our Story', 'Heading', 'How our love story began and grew into a wedding celebration.', { multiline: true }],
  [
    'story.intro',
    'Home — Our Story',
    'Paragraph',
    'From a serendipitous first meeting to a joyful proposal under the stars, our story is full of memorable moments we want to share with you.',
    { multiline: true },
  ],
  ['story.m1.title', 'Home — Our Story', 'Milestone 1: title', '2022 — First meeting'],
  ['story.m1.body', 'Home — Our Story', 'Milestone 1: text', 'They met through mutual friends at a cozy café, and the rest was fate.', { multiline: true }],
  ['story.m2.title', 'Home — Our Story', 'Milestone 2: title', '2024 — First trip together'],
  [
    'story.m2.body',
    'Home — Our Story',
    'Milestone 2: text',
    'A weekend escape to the coast brought them even closer and proved they were ready for the next chapter.',
    { multiline: true },
  ],
  ['story.m3.title', 'Home — Our Story', 'Milestone 3: title', '2025 — Engagement'],
  [
    'story.m3.body',
    'Home — Our Story',
    'Milestone 3: text',
    'A romantic proposal under the stars sealed their promise to spend forever together.',
    { multiline: true },
  ],

  // Home — The couple
  ['couple.flag', 'Home — The couple', 'Small label', 'The couple'],
  ['couple.heading', 'Home — The couple', 'Heading', 'Meet the bride and groom.'],

  // Home — Wedding events
  ['events.flag', 'Home — Wedding events', 'Small label', 'Wedding events'],
  ['events.heading', 'Home — Wedding events', 'Heading', 'Celebrate with us at the ceremony and reception.', { multiline: true }],
  [
    'events.intro',
    'Home — Wedding events',
    'Paragraph',
    'We are excited to welcome our family and friends for a day filled with love, joy, and unforgettable moments.',
    { multiline: true },
  ],
  ['events.labelDate', 'Home — Wedding events', 'Event card label: date', 'Date'],
  ['events.labelTime', 'Home — Wedding events', 'Event card label: time', 'Time'],
  ['events.labelVenue', 'Home — Wedding events', 'Event card label: venue', 'Venue'],
  ['events.labelAddress', 'Home — Wedding events', 'Event card label: address', 'Address'],
  ['events.labelParking', 'Home — Wedding events', 'Event card label: parking', 'Parking'],
  ['events.labelDressCode', 'Home — Wedding events', 'Event card label: dress code', 'Dress code'],
  ['events.mapLink', 'Home — Wedding events', 'Map link', 'View on Google Maps'],

  // Home — Gallery
  ['gallery.flag', 'Home — Gallery', 'Small label', 'Gallery'],
  ['gallery.heading', 'Home — Gallery', 'Heading', 'Photos from our journey together.', { multiline: true }],
  [
    'gallery.intro',
    'Home — Gallery',
    'Paragraph',
    'Enjoy a curated collection of moments from our story, engagement, and memories shared with loved ones.',
    { multiline: true },
  ],

  // Home — FAQ
  ['faq.flag', 'Home — FAQ', 'Small label', 'FAQ'],
  ['faq.heading', 'Home — FAQ', 'Heading', 'Frequently asked questions.'],
  [
    'faq.intro',
    'Home — FAQ',
    'Paragraph',
    'Answers to the questions we hear most often — reach out if yours isn’t here.',
    { multiline: true },
  ],

  // Home — Wishes
  ['wishes.flag', 'Home — Wishes', 'Small label', 'Wishes'],
  ['wishes.heading', 'Home — Wishes', 'Heading', 'Thank you for being part of our story.'],
  [
    'wishes.intro',
    'Home — Wishes',
    'Paragraph',
    'We can’t wait to celebrate with you. View your personal invitation to RSVP and see your event details.',
    { multiline: true },
  ],
  ['wishes.button', 'Home — Wishes', 'Button', 'View Your Invitation'],

  // Footer
  [
    'footer.text',
    'Footer',
    'Footer line',
    'Wedding day: {weddingDate} · {coupleNames}’s celebration website',
    { multiline: true, tags: [ACCEPTED_TAGS.date, ACCEPTED_TAGS.couple] },
  ],

  // Sign-in page
  ['gate.codeLabel', 'Sign-in page', 'Code box label (read by screen readers)', 'Invitation code'],
  ['gate.placeholder', 'Sign-in page', 'Code box hint', 'Enter your invitation code'],
  ['gate.button', 'Sign-in page', 'Button', 'Open'],
  ['gate.buttonBusy', 'Sign-in page', 'Button while checking', 'Opening…'],
  ['gate.errorEmpty', 'Sign-in page', 'Message: nothing typed', 'Please enter the code printed on your invitation.'],
  [
    'gate.errorNotFound',
    'Sign-in page',
    'Message: code not found',
    'We couldn’t find that code. Please check your invitation card and try again.',
    { multiline: true },
  ],
  ['gate.errorTooMany', 'Sign-in page', 'Message: too many tries', 'Too many attempts. Please wait a few minutes, then try again.', { multiline: true }],
  ['gate.errorExpired', 'Sign-in page', 'Message: page open too long', 'This page has been open a while. Please refresh it and try again.', { multiline: true }],
  ['gate.errorGeneric', 'Sign-in page', 'Message: something went wrong', 'Something went wrong. Please try again.'],
  ['gate.opening', 'Sign-in page', 'Envelope opening (read by screen readers)', 'Opening your invitation…'],

  // Invitation page
  ['invitation.kicker', 'Invitation page', 'Envelope card: small line', 'You are invited'],
  ['invitation.heading', 'Invitation page', 'Heading', 'Invitation for {guestName}', { tags: [ACCEPTED_TAGS.guest] }],
  [
    'invitation.statusThanks',
    'Invitation page',
    'Message after they answered',
    'Thank you for your response! Your current status is {status}. You can still change your response if needed.',
    { multiline: true, tags: ['{status}'] },
  ],
  [
    'invitation.statusWaiting',
    'Invitation page',
    'Message before they answer',
    'We are looking forward to hearing from you about your attendance.',
    { multiline: true },
  ],
  ['invitation.eventsHeading', 'Invitation page', 'Events heading', 'Event Details'],

  // RSVP — who is coming
  ['rsvp.title', 'RSVP — who is coming', 'Heading', 'Who’s Coming?'],
  ['rsvp.intro', 'RSVP — who is coming', 'Paragraph', 'Let {coupleNames} know who from your party will be attending.', { multiline: true, tags: [ACCEPTED_TAGS.couple] }],
  ['rsvp.accept', 'RSVP — who is coming', 'Button: accept', 'Accept'],
  ['rsvp.decline', 'RSVP — who is coming', 'Button: decline', 'Decline'],
  ['rsvp.submit', 'RSVP — who is coming', 'Button: submit', 'Submit RSVP'],
  ['rsvp.submitBusy', 'RSVP — who is coming', 'Button while saving', 'Processing…'],
  ['rsvp.overlay', 'RSVP — who is coming', 'Full-screen message while saving', 'Processing your RSVP…'],
  ['rsvp.pendingApproval', 'RSVP — who is coming', 'Tag on a person waiting for approval', 'Waiting for admin approval'],
  ['rsvp.addPrompt', 'RSVP — who is coming', 'Add-a-person question', 'Need to add someone not on this list?'],
  ['rsvp.addPlaceholder', 'RSVP — who is coming', 'Add-a-person box hint', 'Their full name'],
  ['rsvp.addButton', 'RSVP — who is coming', 'Add-a-person button', 'Request'],
  ['rsvp.addBusy', 'RSVP — who is coming', 'Add-a-person button while sending', 'Sending...'],
  ['rsvp.addNote', 'RSVP — who is coming', 'Add-a-person small note', 'This needs a quick approval before it’s added to your list.', { multiline: true }],

  // RSVP — messages
  ['rsvp.toastAccepted', 'RSVP — messages', 'Pop-up: accepted', 'RSVP submitted — see you on {weddingDate}!', { multiline: true, tags: [ACCEPTED_TAGS.date] }],
  ['rsvp.toastAcceptedNoDate', 'RSVP — messages', 'Pop-up: accepted (no wedding date set)', 'RSVP submitted. We look forward to seeing you!', { multiline: true }],
  [
    'rsvp.toastDeclined',
    'RSVP — messages',
    'Pop-up: declined',
    'Thank you for letting us know. We hope to celebrate together another time.',
    { multiline: true },
  ],
  [
    'rsvp.toastRequestSent',
    'RSVP — messages',
    'Pop-up: request to add a person sent',
    'Request sent! {coupleFirstName}’s admin will need to approve it before it’s added.',
    { multiline: true, tags: ['{coupleFirstName}'] },
  ],
  ['rsvp.errorUnanswered', 'RSVP — messages', 'Message: someone not answered', 'Please accept or decline for everyone in the list.', { multiline: true }],

  // RSVP — single answer (older invitations)
  [
    'legacy.stickyBar',
    'RSVP — single answer (older invitations)',
    'Bottom bar question',
    '{coupleNames} are waiting for your response 💍 — Will you join us?',
    { multiline: true, tags: [ACCEPTED_TAGS.couple] },
  ],
  ['legacy.formTitle', 'RSVP — single answer (older invitations)', 'Form heading', 'Respond to Invitation'],
  ['legacy.formTitleDone', 'RSVP — single answer (older invitations)', 'Form heading after answering', 'Your RSVP Response'],
  ['legacy.optionAttend', 'RSVP — single answer (older invitations)', 'Choice: attending', 'I will attend and celebrate with you'],
  ['legacy.optionDecline', 'RSVP — single answer (older invitations)', 'Choice: not attending', 'I will not be able to attend'],
  ['legacy.changeButton', 'RSVP — single answer (older invitations)', 'Button: change answer', 'Change Your Response'],
];

export const SITE_TEXT_FIELDS = ROWS.map(([key, group, label, defaultText, options = {}]) => ({
  key,
  group,
  label,
  defaultText,
  multiline: Boolean(options.multiline),
  tags: options.tags ?? [],
}));

export const SITE_TEXT_KEYS = SITE_TEXT_FIELDS.map((field) => field.key);

const DEFAULTS = Object.fromEntries(SITE_TEXT_FIELDS.map((field) => [field.key, field.defaultText]));

export const MAX_SITE_TEXT_LENGTH = 1000;

export function defaultSiteText(key) {
  return DEFAULTS[key] ?? '';
}

/** Replaces {tag} with vars.tag. A tag with no value is left as written. */
export function fillText(template, vars = {}) {
  return String(template).replace(/\{(\w+)\}/g, (whole, name) =>
    vars[name] === undefined || vars[name] === null ? whole : String(vars[name])
  );
}

/**
 * Builds the lookup the pages use: t('hero.heading') or
 * t('hero.flag', { weddingDate }). `texts` holds the admin's edits; anything
 * missing falls back to the default wording.
 */
export function createT(texts = {}) {
  return (key, vars) => {
    const edited = texts[key];
    const template = typeof edited === 'string' && edited !== '' ? edited : defaultSiteText(key);
    return fillText(template, vars);
  };
}
