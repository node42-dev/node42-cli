import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs   from 'fs';
import path from 'path';
import os   from 'os';
import esmock from 'esmock';
import { createCliJsonFileAdapter } from '../src/db/adapters/cli.json.db.js';
import { createDb }              from '../src/db/db.js';

const TEST_DB = path.join(os.tmpdir(), 'n42-user-test-db.json');

let db;
let adapter;

describe('user', () => {

  beforeEach(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    adapter = createCliJsonFileAdapter(TEST_DB);
    db      = createDb(adapter);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  async function getUser() {
    return esmock('../src/identity/user.js', {
      '../src/db/db.js':              { createDb: () => db, indexBy: () => {}, indexByFn: () => {} },
      '../src/db/adapters/cli.json.db.js':{ createJsonFileAdapter: () => adapter },
    });
  }

  it('returns default user when index does not exist', async () => {
    const { getUserWithIndex } = await getUser();
    const u = await getUserWithIndex(0);
    assert.equal(u.id,       'n/a');
    assert.equal(u.userName, 'n/a');
  });

  it('returns user by index when present', async () => {
    adapter.save({ User: [{ id: '1', userName: 'User', userMail: 'user@test.com', role: 'user' }] });
    const { getUserWithIndex } = await getUser();
    const u = await getUserWithIndex(0);
    assert.equal(u.id, '1');
  });

  it('returns user by id when present', async () => {
    adapter.save({ User: [{ id: '1', userName: 'User', userMail: 'user@test.com', role: 'user' }] });
    const { getUserWithId } = await getUser();
    const u = await getUserWithId('1');
    assert.equal(u.userMail, 'user@test.com');
  });

  it('returns default user when id is missing', async () => {
    const { getUserWithId } = await getUser();
    const u = await getUserWithId('missing');
    assert.equal(u.id, 'n/a');
  });

  it('returns undefined usage when none exists', async () => {
    adapter.save({ User: [{ id: '1', serviceUsage: {} }] });
    const { getUserUsage } = await getUser();
    const usage = await getUserUsage('1', 'discovery', '2026-02');
    assert.equal(usage, undefined);
  });

  it('sets and retrieves service usage', async () => {
    adapter.save({ User: [{ id: '1', serviceUsage: {} }] });
    const { getUserUsage, setUserUsage } = await getUser();
    await setUserUsage('1', 'discovery', '2026-02', 5);
    const usage = await getUserUsage('1', 'discovery', '2026-02');
    assert.equal(usage, 5);
  });

  it('does nothing when setting usage for missing user', async () => {
    const { setUserUsage } = await getUser();
    // should not throw and db should remain empty
    await setUserUsage('missing', 'discovery', '2026-02', 5);
    const users = db.getAll('User');
    assert.equal(users.length, 0);
  });
});