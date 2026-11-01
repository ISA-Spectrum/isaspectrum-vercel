import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('go-live SQL uses UUID message references and a PostgREST-compatible meal index', async () => {
  const baseline = await readFile(new URL('../supabase/oidc_client.sql', import.meta.url), 'utf8');
  const corrective = await readFile(new URL('../supabase/20260913_go_live_fixes.sql', import.meta.url), 'utf8');
  const checker = await readFile(new URL('../api/api/checker/messages.js', import.meta.url), 'utf8');

  assert.match(baseline, /related_id uuid references public\.messages\(id\)/);
  assert.match(baseline, /message_id uuid not null references public\.messages\(id\)/);
  assert.match(baseline, /p_message_id uuid/);
  assert.doesNotMatch(baseline, /p_message_id bigint/);
  assert.match(baseline, /create unique index meal_ratings_business_user_date_key\s+on public\.meal_ratings \(business_user_id, rating_date\);/);
  assert.match(corrective, /Expected public\.messages\.id to be uuid/);
  assert.match(corrective, /notify pgrst, 'reload schema'/);
  assert.match(checker, /p_message_id: id/);
  assert.doesNotMatch(checker, /p_message_id: Number\(id\)/);
});
