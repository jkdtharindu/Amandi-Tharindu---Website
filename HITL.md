# Human-in-the-Loop (HITL) Guardrails

This project requires explicit human approval before certain actions are taken. Do not proceed unless the user explicitly says "yes" or "yes, proceed".

## Required HITL Pause Rules

Whenever one of the following actions is about to happen, stop and present the checkpoint message exactly in this format:

"⚠️ HITL CHECKPOINT: I am about to [action]. This will [consequence]. Shall I proceed? (yes / no)"

## Actions Requiring HITL

- Any deployment or publish command
- Database migrations (up or down)
- Deleting files or records
- Touching environment variables or secrets
- git push to main or production branches
- Any external API call that costs money or sends messages
- Creating or updating live production content that affects guests publicly
- Sending WhatsApp, SMS, or email messages to guests
- Changing admin access, authentication, or role configuration
- Modifying Supabase storage buckets, policies, or database permissions
- Making changes that could affect the live wedding website during the RSVP period

## Project-Specific HITL Notes

Because this project is a guest-facing wedding website with RSVP handling and messaging, the following are especially sensitive:

- Any change that could expose or alter guest RSVP data
- Any change that affects invitation access or authentication
- Any change that sends reminders, confirmations, or bulk communications
- Any update to payment, gifting, or external booking integrations (if introduced later)
- Any change to public pages that could break the wedding experience during the event period

## Expected Behavior

- Never infer consent
- Never proceed because it seems like the right next step
- Never act on a vague or implied approval
- Wait for a clear explicit confirmation before continuing

Note: UI polish and local prototype changes (code edits, styling, docs) do not bypass HITL requirements — any deploys, migrations, or external sends still require the exact HITL checkpoint confirmation.

## Clarification: WhatsApp reminder button (added 2026-09-03)

The admin guest list has a "send RSVP reminder" button on pending guests with a WhatsApp number. It builds a `wa.me` deep link from an admin-editable message and opens it — nothing is sent programmatically. The admin still presses Send inside WhatsApp under their own account. This does NOT call an external paid API and does NOT by itself constitute "sending WhatsApp... messages to guests" in the automated sense the rule above is guarding against, so it does not require its own HITL checkpoint. If this is later replaced with a programmatic send (Twilio, or any provider called directly from server code), that change brings back the full HITL requirement above.
