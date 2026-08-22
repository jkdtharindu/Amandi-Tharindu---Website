import crypto from 'node:crypto';
import { query } from '../db.js';
import { siteSections } from '../data/sectionsStore.js';
import { validateSectionInput } from './validateSection.js';

const useDb = Boolean(process.env.DATABASE_URL);

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    page: row.page,
    sectionType: row.section_type,
    title: row.title || '',
    content: row.content || '',
    displayOrder: row.display_order,
    isVisible: row.is_visible,
  };
}

export async function listSections(page) {
  if (!useDb) {
    return siteSections
      .filter((s) => !page || s.page === page)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  const { rows } = page
    ? await query('SELECT * FROM site_sections WHERE page = $1 ORDER BY display_order ASC', [page])
    : await query('SELECT * FROM site_sections ORDER BY page ASC, display_order ASC');
  return rows.map(mapRow);
}

export async function createSection(input) {
  const result = validateSectionInput(input);
  if (!result.success) return result;

  const section = { id: crypto.randomUUID(), ...result.section };

  if (!useDb) {
    siteSections.push(section);
    return { success: true, section };
  }

  const { rows } = await query(
    `INSERT INTO site_sections (page, section_type, title, content, display_order, is_visible)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [section.page, section.sectionType, section.title, section.content, section.displayOrder, section.isVisible]
  );
  return { success: true, section: mapRow(rows[0]) };
}

export async function updateSection(id, patch) {
  if (!useDb) {
    const existing = siteSections.find((s) => s.id === id);
    if (!existing) return { success: false, reason: 'section_not_found' };

    if (patch.title !== undefined) existing.title = String(patch.title).trim();
    if (patch.content !== undefined) existing.content = String(patch.content).trim();
    if (patch.displayOrder !== undefined) existing.displayOrder = Number(patch.displayOrder) || 0;
    if (patch.isVisible !== undefined) existing.isVisible = Boolean(patch.isVisible);

    return { success: true, section: existing };
  }

  const { rows: existingRows } = await query('SELECT * FROM site_sections WHERE id = $1', [id]);
  if (!existingRows[0]) return { success: false, reason: 'section_not_found' };

  const current = mapRow(existingRows[0]);
  const next = {
    title: patch.title !== undefined ? String(patch.title).trim() : current.title,
    content: patch.content !== undefined ? String(patch.content).trim() : current.content,
    displayOrder: patch.displayOrder !== undefined ? Number(patch.displayOrder) || 0 : current.displayOrder,
    isVisible: patch.isVisible !== undefined ? Boolean(patch.isVisible) : current.isVisible,
  };

  const { rows } = await query(
    `UPDATE site_sections SET title = $1, content = $2, display_order = $3, is_visible = $4 WHERE id = $5 RETURNING *`,
    [next.title, next.content, next.displayOrder, next.isVisible, id]
  );
  return { success: true, section: mapRow(rows[0]) };
}

export async function deleteSection(id) {
  if (!useDb) {
    const index = siteSections.findIndex((s) => s.id === id);
    if (index === -1) return { success: false, reason: 'section_not_found' };
    siteSections.splice(index, 1);
    return { success: true };
  }

  await query('DELETE FROM site_sections WHERE id = $1', [id]);
  return { success: true };
}
