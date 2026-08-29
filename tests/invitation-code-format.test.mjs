import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractSurname,
  generateInvitationCode,
  validateManualCode,
  validateCodeFormatSettings,
  SURNAME_POSITIONS,
  CODE_FORMAT_DEFAULTS,
} from '../src/guest-auth/generateInvitationCode.js';

// Configurable InvitationCode format.
//
// Codes are printed on physical cards and are the guest's login credential, so
// the format is free to change only until printing. These tests pin what each
// setting produces, and — just as importantly — that changing a setting never
// rewrites a code that already exists.

test('the default format is unchanged: surname last, no group prefix', () => {
  assert.deepEqual(CODE_FORMAT_DEFAULTS, { surnamePosition: 'last', groupPrefix: false });
  assert.equal(generateInvitationCode('Nimal Silva', []), 'SILVA-001');
});

test('surnamePosition "first" takes the leading name token instead', () => {
  // Sinhalese names commonly place the ancestral/ge name first, so the last
  // word is often the given name — which would make the code unrecognisable
  // on the card.
  const options = { surnamePosition: 'first' };
  assert.equal(extractSurname('Wickramasinghe Arachchige Nimal', 'first'), 'WICKRAMASINGHE');
  assert.equal(generateInvitationCode('Wickramasinghe Arachchige Nimal', [], options), 'WICKRAMASINGHE-001');
});

test('surnamePosition "last" still takes the trailing token', () => {
  assert.equal(extractSurname('Wickramasinghe Arachchige Nimal', 'last'), 'NIMAL');
  assert.equal(extractSurname('  Kumara Perera  '), 'PERERA');
});

test('a single-word name works under either setting', () => {
  assert.equal(extractSurname('Nimal', 'first'), 'NIMAL');
  assert.equal(extractSurname('Nimal', 'last'), 'NIMAL');
});

test('an empty or symbol-only name falls back to GUEST rather than producing "-001"', () => {
  assert.equal(extractSurname('', 'first'), 'GUEST');
  assert.equal(extractSurname('   ', 'last'), 'GUEST');
  assert.equal(extractSurname('!!!', 'last'), 'GUEST');
  assert.equal(generateInvitationCode('', []), 'GUEST-001');
});

test('groupPrefix prepends a single letter for the relationship group', () => {
  const opts = (relationship) => ({ groupPrefix: true, relationship });

  assert.equal(generateInvitationCode('Nimal Silva', [], opts('Relations')), 'R-SILVA-001');
  assert.equal(generateInvitationCode('Nimal Silva', [], opts('Colleagues')), 'C-SILVA-001');
  assert.equal(generateInvitationCode('Nimal Silva', [], opts('Neighbours')), 'N-SILVA-001');
  assert.equal(generateInvitationCode('Nimal Silva', [], opts('Friends')), 'F-SILVA-001');
});

test('groupPrefix is skipped when the relationship is unknown, rather than emitting "UNDEFINED-"', () => {
  assert.equal(generateInvitationCode('Nimal Silva', [], { groupPrefix: true }), 'SILVA-001');
  assert.equal(generateInvitationCode('Nimal Silva', [], { groupPrefix: true, relationship: 'Nonsense' }), 'SILVA-001');
});

test('numbering runs per prefix, so groups do not share a sequence', () => {
  const existing = ['R-SILVA-001', 'R-SILVA-002', 'C-SILVA-001'];

  assert.equal(
    generateInvitationCode('Nimal Silva', existing, { groupPrefix: true, relationship: 'Relations' }),
    'R-SILVA-003'
  );
  assert.equal(
    generateInvitationCode('Nimal Silva', existing, { groupPrefix: true, relationship: 'Colleagues' }),
    'C-SILVA-002'
  );
});

test('a plain surname sequence is not disturbed by prefixed codes of the same surname', () => {
  // 'SILVA-'.startsWith check must not match 'R-SILVA-001', or the unprefixed
  // sequence would jump.
  assert.equal(generateInvitationCode('Nimal Silva', ['R-SILVA-007'], {}), 'SILVA-001');
});

test('a generated code never collides with an existing one, whatever the format', () => {
  // Switching format mid-list must not re-issue a code already on a card.
  const existing = ['SILVA-001', 'SILVA-002', 'R-SILVA-001'];
  const next = generateInvitationCode('Nimal Silva', existing, {});
  assert.ok(!existing.includes(next), 'must be unique');
  assert.equal(next, 'SILVA-003');
});

// --- manual override ------------------------------------------------------

test('a manual code is accepted, trimmed and upper-cased', () => {
  const result = validateManualCode('  silva-042 ');
  assert.equal(result.success, true);
  assert.equal(result.code, 'SILVA-042');
});

test('a manual code may use any letters, digits and hyphens the couple like', () => {
  assert.equal(validateManualCode('AMMA-01').code, 'AMMA-01');
  assert.equal(validateManualCode('R-PERERA-100').code, 'R-PERERA-100');
  assert.equal(validateManualCode('TABLE7').code, 'TABLE7');
});

test('a manual code is rejected when it could not be read off a printed card', () => {
  for (const bad of ['', '   ', 'has space', 'sym#bol', 'sri/lanka', 'a'.repeat(41)]) {
    const result = validateManualCode(bad);
    assert.equal(result.success, false, `"${bad}" must be rejected`);
    assert.ok(result.reason, 'and must say why');
  }
});

// --- format settings validation -------------------------------------------

test('code format settings accept the supported values', () => {
  const result = validateCodeFormatSettings({ surnamePosition: 'first', groupPrefix: true });
  assert.equal(result.success, true);
  assert.deepEqual(result.settings, { surnamePosition: 'first', groupPrefix: true });
});

test('code format settings reject an unsupported surname position', () => {
  const result = validateCodeFormatSettings({ surnamePosition: 'middle' });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'invalid_surname_position');
});

test('groupPrefix accepts checkbox-style truthy values from a form post', () => {
  assert.equal(validateCodeFormatSettings({ groupPrefix: 'on' }).settings.groupPrefix, true);
  assert.equal(validateCodeFormatSettings({ groupPrefix: 'true' }).settings.groupPrefix, true);
  assert.equal(validateCodeFormatSettings({ groupPrefix: false }).settings.groupPrefix, false);
  assert.equal(validateCodeFormatSettings({ groupPrefix: '' }).settings.groupPrefix, false);
});

test('SURNAME_POSITIONS is the single source of truth for the picker', () => {
  assert.deepEqual(SURNAME_POSITIONS, ['last', 'first']);
});
