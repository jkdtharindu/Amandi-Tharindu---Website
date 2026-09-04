import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { validateSectionInput } from '../src/sections/validateSection.js';
import { listSections, createSection, updateSection, deleteSection } from '../src/sections/sectionsRepo.js';
import { siteSections } from '../src/data/sectionsStore.js';

beforeEach(() => {
  siteSections.length = 0;
});

test('validateSectionInput rejects an invalid page', () => {
  const result = validateSectionInput({ page: 'not-a-page', sectionType: 'text' });
  assert.equal(result.success, false);
  assert.equal(result.errors[0].field, 'page');
});

test('validateSectionInput rejects an invalid section type', () => {
  const result = validateSectionInput({ page: 'home', sectionType: 'not-a-type' });
  assert.equal(result.success, false);
  assert.equal(result.errors[0].field, 'sectionType');
});

test('validateSectionInput accepts valid input with defaults', () => {
  const result = validateSectionInput({ page: 'home', sectionType: 'text', title: ' Hello ' });
  assert.equal(result.success, true);
  assert.equal(result.section.title, 'Hello');
  assert.equal(result.section.isVisible, true);
  assert.equal(result.section.displayOrder, 0);
});

test('createSection then listSections returns the created section for its page', async () => {
  const created = await createSection({ page: 'gallery', sectionType: 'gallery', title: 'Extra Photos' });
  assert.equal(created.success, true);

  const sections = await listSections('gallery');
  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, 'Extra Photos');
});

test('updateSection changes visibility and content', async () => {
  const created = await createSection({ page: 'home', sectionType: 'text', title: 'Note' });
  const updated = await updateSection(created.section.id, { isVisible: false, content: 'Updated content' });

  assert.equal(updated.success, true);
  assert.equal(updated.section.isVisible, false);
  assert.equal(updated.section.content, 'Updated content');
});

test('updateSection returns not_found for an unknown id', async () => {
  const result = await updateSection('missing-id', { title: 'x' });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'section_not_found');
});

test('deleteSection removes the section', async () => {
  const created = await createSection({ page: 'wishes', sectionType: 'text', title: 'Note' });
  const deleted = await deleteSection(created.section.id);
  assert.equal(deleted.success, true);

  const sections = await listSections('wishes');
  assert.equal(sections.length, 0);
});
