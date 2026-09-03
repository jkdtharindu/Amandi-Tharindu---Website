import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_RSVP_REMINDER_TEMPLATE,
  renderTemplate,
  buildInvitationLink,
  buildWhatsAppLink,
} from '../src/admin/messageTemplates.js';

test('default template mentions the guest and includes a link placeholder', () => {
  assert.match(DEFAULT_RSVP_REMINDER_TEMPLATE, /\{name\}/);
  assert.match(DEFAULT_RSVP_REMINDER_TEMPLATE, /\{link\}/);
});

test('renderTemplate substitutes name, link, and code placeholders', () => {
  const result = renderTemplate('Hi {name}, code {code}, link {link}', {
    name: 'Ruwan',
    code: 'NEI-RU-628',
    link: 'https://example.com/invitation/NEI-RU-628',
  });
  assert.equal(result, 'Hi Ruwan, code NEI-RU-628, link https://example.com/invitation/NEI-RU-628');
});

test('renderTemplate replaces every occurrence of a placeholder', () => {
  const result = renderTemplate('{name} {name}', { name: 'Ruwan' });
  assert.equal(result, 'Ruwan Ruwan');
});

test('renderTemplate leaves unmatched placeholders untouched', () => {
  const result = renderTemplate('Hi {name}, {unknown}', { name: 'Ruwan' });
  assert.equal(result, 'Hi Ruwan, {unknown}');
});

test('renderTemplate treats missing values as empty strings', () => {
  const result = renderTemplate('Hi {name}!', {});
  assert.equal(result, 'Hi !');
});

test('buildInvitationLink joins the site URL and code', () => {
  assert.equal(
    buildInvitationLink('https://example.com', 'NEI-RU-628'),
    'https://example.com/invitation/NEI-RU-628'
  );
});

test('buildInvitationLink strips a trailing slash from the site URL', () => {
  assert.equal(
    buildInvitationLink('https://example.com/', 'NEI-RU-628'),
    'https://example.com/invitation/NEI-RU-628'
  );
});

test('buildWhatsAppLink strips formatting characters from the phone number', () => {
  const link = buildWhatsAppLink('+94 71 234 5678', 'Hello');
  assert.equal(link, 'https://wa.me/94712345678?text=Hello');
});

test('buildWhatsAppLink URL-encodes the message', () => {
  const link = buildWhatsAppLink('+94712345678', 'Hi Ruwan, RSVP at https://example.com?a=1&b=2');
  assert.equal(
    link,
    'https://wa.me/94712345678?text=Hi%20Ruwan%2C%20RSVP%20at%20https%3A%2F%2Fexample.com%3Fa%3D1%26b%3D2'
  );
});

test('buildWhatsAppLink rejects a phone number with no digits', () => {
  assert.throws(() => buildWhatsAppLink('n/a', 'Hello'), /invalid_phone_number/);
  assert.throws(() => buildWhatsAppLink(null, 'Hello'), /invalid_phone_number/);
});

test('buildWhatsAppLink rejects a phone number that is too short to be real', () => {
  assert.throws(() => buildWhatsAppLink('123', 'Hello'), /invalid_phone_number/);
});
