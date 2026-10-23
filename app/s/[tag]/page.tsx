import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getThemeSettings } from '@/src/theme/themeRepo.js';
import { listTemplates } from '@/src/messaging/messageTemplatesRepo.js';
import { levelForShareTag } from '@/src/messaging/messageLevels.js';
import ShareForward from './ShareForward';

/**
 * The page behind the link in each WhatsApp message (PRD section 24). WhatsApp
 * reads this page's tags to build the link card, so it must stay readable by a
 * signed-out crawler (see src/site-gate.js). It holds no guest information: a
 * visitor is simply forwarded to the site, where the gate asks for their code.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ tag: string }> };

async function loadCard(tag: string) {
  const level = levelForShareTag(tag);
  if (!level) return null;

  let coupleNames = 'Tharindu & Amandi';
  let imageUrl: string | null = null;
  try {
    coupleNames = (await getThemeSettings()).coupleNames || coupleNames;
  } catch (error) {
    console.error('share page: getThemeSettings failed:', error);
  }
  try {
    const templates = await listTemplates();
    imageUrl = templates.find((entry: { name: string }) => entry.name === level.templateName)?.imageUrl ?? null;
  } catch (error) {
    console.error('share page: listTemplates failed:', error);
  }
  return { coupleNames, description: level.shareCard, imageUrl };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const card = await loadCard((await params).tag);
  if (!card) return {};
  const images = card.imageUrl ? [{ url: card.imageUrl, width: 1200, height: 630 }] : undefined;
  return {
    title: card.coupleNames,
    description: card.description,
    robots: { index: false, follow: false },
    openGraph: { title: card.coupleNames, description: card.description, type: 'website', images },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: card.coupleNames,
      description: card.description,
      images: images?.map((image) => image.url),
    },
  };
}

export default async function SharePage({ params }: Props) {
  const card = await loadCard((await params).tag);
  if (!card) notFound();
  return <ShareForward coupleNames={card.coupleNames} />;
}
