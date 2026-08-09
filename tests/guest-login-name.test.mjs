import assert from 'assert';

const { describe, it } = await import('node:test');

describe('loginGuestByName (Slice 2 - Name lookup)', () => {
  it('exports a `loginGuestByName` function (failing test scaffold)', async () => {
    const auth = await import('../src/guest-auth/index.js');
    assert.ok(typeof auth.loginGuestByName === 'function', 'loginGuestByName should be exported as a function');
  });

  it('returns a guest object for an exact name match (failing test)', async () => {
    const { loginGuestByName } = await import('../src/guest-auth/index.js');
    const result = await loginGuestByName('Malinda Silva');
    assert.ok(result && result.guestId, 'should return an object with guestId for exact name');
  });

  it('returns candidate list when name is ambiguous (failing test)', async () => {
    const { loginGuestByName } = await import('../src/guest-auth/index.js');
    const result = await loginGuestByName('Silva');
    assert.ok(Array.isArray(result) && result.length > 0, 'should return an array of candidate guests when name is ambiguous');
  });
});
