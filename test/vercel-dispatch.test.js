import test from 'node:test';
import assert from 'node:assert/strict';
import messages from '../api/api/messages.js';
import uploads from '../api/api/uploads.js';
import notifications from '../api/api/notifications.js';
import checker from '../api/api/checker/messages.js';
for (const [name, handler, method] of [['messages', messages, 'POST'], ['uploads', uploads, 'POST'], ['notifications', notifications, 'PATCH'], ['checker', checker, 'PATCH']]) {
  test(`${name} dispatches ${method} to authentication rather than 405`, async () => {
    const response = await handler(new Request(`https://api.celestivast.com/api/${name}`, { method, headers: { Origin: 'https://untrusted.example' } }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, 'invalid_origin');
    assert.equal((await handler(new Request('https://api.celestivast.com/api/test', { method: 'OPTIONS' }))).status, 204);
  });
}
