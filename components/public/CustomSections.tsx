import Image from "next/image";
import type { Section } from "@/components/admin/SectionManager";

/**
 * Renders admin-managed content sections (P1-11) for a public page. Ports
 * src/server.js's renderSections() — visible sections only, already ordered
 * by the repo (sectionsRepo.js: displayOrder ASC).
 */
export default function CustomSections({
  sections,
  inPanel = false,
}: {
  sections: Section[];
  /** Render only the cards, to sit inside a homepage panel instead of below it. */
  inPanel?: boolean;
}) {
  const visible = sections.filter((section) => section.isVisible);
  if (visible.length === 0) return null;

  const Wrapper = inPanel ? "div" : "section";
  return (
    <Wrapper className={inPanel ? "panel-cards grid-panel custom-sections" : "custom-sections"}>
      {visible.map((section) => (
        <article className="story-card" key={section.id}>
          {section.imageUrl && (
            <Image
              src={section.imageUrl}
              alt={section.title || ''}
              className="section-image"
              width={800}
              height={320}
              sizes="100vw"
            />
          )}
          {section.title && <h3>{section.title}</h3>}
          {section.content && <p>{section.content}</p>}
        </article>
      ))}
    </Wrapper>
  );
}
