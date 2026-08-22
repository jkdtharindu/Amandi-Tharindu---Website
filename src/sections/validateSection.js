export const VALID_PAGES = ['home', 'our-story', 'celebration', 'gallery', 'wishes'];
export const VALID_SECTION_TYPES = ['text', 'image', 'gallery', 'custom'];

export function validateSectionInput(input) {
  const errors = [];
  const page = String(input?.page || '').trim();
  const sectionType = String(input?.sectionType || '').trim();
  const title = String(input?.title || '').trim();
  const content = String(input?.content || '').trim();

  if (!VALID_PAGES.includes(page)) {
    errors.push({ field: 'page', reason: 'invalid_page' });
  }

  if (!VALID_SECTION_TYPES.includes(sectionType)) {
    errors.push({ field: 'sectionType', reason: 'invalid_section_type' });
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    section: {
      page,
      sectionType,
      title,
      content,
      displayOrder: Number.isFinite(Number(input?.displayOrder)) ? Number(input.displayOrder) : 0,
      isVisible: input?.isVisible !== false,
    },
  };
}
