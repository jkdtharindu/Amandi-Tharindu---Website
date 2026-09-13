import type { Section } from "@/components/admin/SectionManager";

/**
 * Renders admin-managed FAQ sections (page: "faq") as a native <details>/
 * <summary> accordion -- title is the question, content is the answer.
 * Reuses the existing sections mechanism (P1-11); no new admin surface.
 */
export default function FaqAccordion({ sections }: { sections: Section[] }) {
  const visible = sections.filter((section) => section.isVisible && section.title);
  if (visible.length === 0) return null;

  return (
    <div className="faq-accordion">
      {visible.map((section) => (
        <details className="faq-item" key={section.id}>
          <summary className="faq-question">{section.title}</summary>
          {section.content && <p className="faq-answer">{section.content}</p>}
        </details>
      ))}
    </div>
  );
}
