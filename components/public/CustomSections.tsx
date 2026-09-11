import type { Section } from "@/components/admin/SectionManager";

/**
 * Renders admin-managed content sections (P1-11) for a public page. Ports
 * src/server.js's renderSections() — visible sections only, already ordered
 * by the repo (sectionsRepo.js: displayOrder ASC).
 */
export default function CustomSections({ sections }: { sections: Section[] }) {
  const visible = sections.filter((section) => section.isVisible);
  if (visible.length === 0) return null;

  return (
    <section className="custom-sections">
      {visible.map((section) => (
        <article className="story-card" key={section.id}>
          {section.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- remote, admin-uploaded URL (Vercel Blob); see ImageUploadField.tsx.
            <img src={section.imageUrl} alt={section.title || ''} className="section-image" />
          )}
          {section.title && <h3>{section.title}</h3>}
          {section.content && <p>{section.content}</p>}
        </article>
      ))}
    </section>
  );
}
