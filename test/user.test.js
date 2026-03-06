import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs   from 'fs';
import path from 'path';
import os   from 'os';

const TEST_DB = path.join(os.tmpdir(), 'test-db-user.json');

const { db }                                          = await import('../src/core/db.js');
const { getUserWithIndex, getUserWithId, getUserUsage, setUserUsage } = await import('../src/identity/user.js');

describe('user', () => {

  beforeEach(() => {
    db.setSource(TEST_DB);
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  afterEach(() => {
    mock.restoreAll();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('returns default user when index does not exist', () => {
    const u = getUserWithIndex(0);
    assert.equal(u.id,       'n/a');
    assert.equal(u.userName, 'n/a');
  });

  it('returns user by index when present', () => {
    db.save({ user: [{ id: '1', userName: 'User', userMail: 'user@test.com', role: 'user' }] });
    const u = getUserWithIndex(0);
    assert.equal(u.id, '1');
  });

  it('returns user by id when present', () => {
    db.save({ user: [{ id: '1', userName: 'User', userMail: 'user@test.com', role: 'user' }] });
    const u = getUserWithId('1');
    assert.equal(u.userMail, 'user@test.com');
  });

  it('returns default user when id is missing', () => {
    const u = getUserWithId('missing');
    assert.equal(u.id, 'n/a');
  });

  it('returns undefined usage when none exists', () => {
    db.save({ user: [{ id: '1', serviceUsage: {} }] });
    const usage = getUserUsage('1', 'discovery', '2026-02');
    assert.equal(usage, undefined);
  });

  it('sets and retrieves service usage', () => {
    db.save({ user: [{ id: '1', serviceUsage: {} }] });
    setUserUsage('1', 'discovery', '2026-02', 5);
    const usage = getUserUsage('1', 'discovery', '2026-02');
    assert.equal(usage, 5);
  });

  it('does nothing when setting usage for missing user', (t) => {
    const saveSpy = t.mock.method(db, 'save', () => {});
    setUserUsage('missing', 'discovery', '2026-02', 5);
    assert.equal(saveSpy.mock.calls.length, 0);
  });
});