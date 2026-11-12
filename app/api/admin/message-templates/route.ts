import { NextRequest, NextResponse } from 'next/server';
import { saveTemplate, saveTemplateGroups, removeTemplateAt, listTemplates } from '@/src/messaging/messageTemplatesRepo.js';
import { MESSAGE_LEVELS, variantTemplateName, templateVariants } from '@/src/messaging/messageLevels.js';
import { verifyCsrfToken } from '@/src/csrf.js';
import { getAdminSession, unauthorizedResponse } from '@/lib/adminGuard';

const MAX_BODY_LENGTH = 2000;
const MAX_GROUPS = 50;

const csrfFailure = () =>
  NextResponse.json({ success: false, reason: 'csrf_invalid', message: 'Invalid CSRF token.' }, { status: 403 });

type Level = (typeof MESSAGE_LEVELS)[number];

/** Reads the JSON body, the level and the 1-based wording number every call here needs. */
async function readTarget(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return { error: unauthorizedResponse() };
  if (!verifyCsrfToken(request)) return { error: csrfFailure() };

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return {
      error: NextResponse.json(
        { success: false, reason: 'invalid_json', message: 'Invalid request body.' },
        { status: 400 }
      ),
    };
  }

  const level = MESSAGE_LEVELS.find((entry) => entry.key === body.levelKey) as Level | undefined;
  if (!level) {
    return { error: NextResponse.json({ success: false, message: 'Unknown message level.' }, { status: 400 }) };
  }

  const variant = body.variant === undefined ? 1 : Number(body.variant);
  if (!Number.isInteger(variant) || variant < 1 || variant > level.maxTemplates) {
    return { error: NextResponse.json({ success: false, message: 'Unknown template number.' }, { status: 400 }) };
  }

  return { body, level, variant };
}

/**
 * The saved wordings and their group links, read fresh. Screens that stay open call
 * this so a change made on another device or tab shows up (no cache: always current).
 */
export async function GET(): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return unauthorizedResponse();
  try {
    return NextResponse.json(
      { success: true, templates: await listTemplates() },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Failed to list message templates:', error);
    return NextResponse.json({ success: false, message: 'Could not load the templates.' }, { status: 500 });
  }
}

/**
 * Saves the wording for one message level. Body: { levelKey, body, variant? }.
 * `variant` (1-based, default 1) picks one of the level's wordings; only the Main
 * invitation keeps more than one. Passing an empty body is refused; "Reset to
 * default" sends the level's default wording instead. The wording is shared by both
 * sides (the templates table has no side). Placeholders like [Name], [Code] and
 * [TableNumber] are filled per guest when a message is opened, so they are saved as typed.
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  const target = await readTarget(request);
  if (target.error) return target.error;
  const { body, level, variant } = target as { body: Record<string, unknown>; level: Level; variant: number };

  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text) {
    return NextResponse.json({ success: false, message: 'The message cannot be empty.' }, { status: 400 });
  }
  if (text.length > MAX_BODY_LENGTH) {
    return NextResponse.json(
      { success: false, message: `The message is too long (max ${MAX_BODY_LENGTH} characters).` },
      { status: 400 }
    );
  }

  try {
    const template = await saveTemplate(variantTemplateName(level, variant), text);
    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Failed to save message template:', error);
    return NextResponse.json({ success: false, message: 'Could not save the template.' }, { status: 500 });
  }
}

/**
 * Links one wording of a level to guest groups. Body: { levelKey, variant, groups: string[] }.
 * A group goes to one wording only, so it is taken off the level's other wordings.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const target = await readTarget(request);
  if (target.error) return target.error;
  const { body, level, variant } = target as { body: Record<string, unknown>; level: Level; variant: number };

  if (
    !Array.isArray(body.groups) ||
    body.groups.length > MAX_GROUPS ||
    !body.groups.every((group) => typeof group === 'string' && group.length <= 100)
  ) {
    return NextResponse.json({ success: false, message: 'Groups must be a list of names.' }, { status: 400 });
  }

  try {
    const templates = await listTemplates();
    const current = templateVariants(level, templates).find((entry: { variant: number }) => entry.variant === variant);
    const siblingNames = Array.from({ length: level.maxTemplates }, (_, index) =>
      variantTemplateName(level, index + 1)
    ).filter((name) => name !== variantTemplateName(level, variant));
    const template = await saveTemplateGroups(
      variantTemplateName(level, variant),
      body.groups as string[],
      current?.body ?? level.defaultBody,
      siblingNames
    );
    return NextResponse.json({ success: true, template, templates: await listTemplates() });
  } catch (error) {
    console.error('Failed to link message template groups:', error);
    return NextResponse.json({ success: false, message: 'Could not save the groups.' }, { status: 500 });
  }
}

/**
 * Removes one wording. Body: { levelKey, variant }. Later wordings move up one place
 * so the numbers stay 1, 2, 3 with no gap; removing the only wording puts the level
 * back to its default text. Its groups fall back to template 1.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const target = await readTarget(request);
  if (target.error) return target.error;
  const { level, variant } = target as { level: Level; variant: number };

  try {
    const saved = await listTemplates();
    const names = Array.from({ length: level.maxTemplates }, (_, index) => variantTemplateName(level, index + 1)).filter(
      (name, index) => index === 0 || saved.some((entry: { name: string }) => entry.name === name)
    );
    const index = names.indexOf(variantTemplateName(level, variant));
    if (index === -1) {
      return NextResponse.json({ success: false, message: 'Unknown template number.' }, { status: 400 });
    }
    await removeTemplateAt(names, index);
    return NextResponse.json({ success: true, templates: await listTemplates() });
  } catch (error) {
    console.error('Failed to delete message template:', error);
    return NextResponse.json({ success: false, message: 'Could not remove the template.' }, { status: 500 });
  }
}
