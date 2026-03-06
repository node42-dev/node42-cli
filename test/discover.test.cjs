import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs     from 'fs';
import os     from 'os';
import path   from 'path';
import esmock from 'esmock';

const TEST_DB = path.join(os.tmpdir(), 'test-db-discover.json');

describe('runDiscovery()', () => {

  afterEach(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it('runs discovery and writes json artefact', async () => {
    let fetchCalls  = 0;
    let insertCalls = 0;
    let writeCalls  = 0;
    let usageCalls  = 0;

    const { db } = await import('../src/core/db.js');
    db.setSource(TEST_DB);

    const { runDiscovery } = await esmock('../src/discover.js', {
      '../src/identity/auth.js': {
        fetchWithAuth: async () => {
          fetchCalls++;
          return {
            ok: true,
            headers: { get: (k) => ({
              'X-Node42-RefId':        'ref-123',
              'X-Node42-ServiceUsage': '1',
              'X-Node42-RateLimit':    '100/100',
              'X-Node42-Documents':    null
            })[k] },
            json: async () => ({ result: 'ok' })
          };
        }
      },
      '../src/identity/user.js': {
        getUserWithIndex: () => ({ id: '1' }),
        setUserUsage:     () => { usageCalls++; }
      },
      '../src/core/utils.js': {
        startSpinner:      () => () => {},
        getShortId:        () => 'abc123',
        getArtefactExt:    () => 'json',
        buildDocLabel:     () => {},
        promptForDocument: async () => null
      },
      '../src/core/db.js': {
        db: { insert: () => { insertCalls++; }, get: () => [] }
      },
      'fs': {
        ...fs,
        writeFileSync: () => { writeCalls++; }
      }
    });

    const origLog = console.log;
    console.log   = () => {};

    await runDiscovery('9915:test', { env: 'TEST', output: 'json', format: 'json' });

    console.log = origLog;

    assert.equal(fetchCalls,  1);
    assert.equal(insertCalls, 1);
    assert.ok(writeCalls > 0);
    assert.equal(usageCalls,  1);
  });

  it('handles API error response', async () => {
    let errorCalls = 0;
    let exitCalls  = 0;

    const { runDiscovery } = await esmock('../src/discover.js', {
      '../src/auth.js': {
        fetchWithAuth: async () => ({
          ok:   false,
          json: async () => ({ code: 'N42E-5000', message: 'fail' })
        })
      },
      '../src/identity/user.js':  { getUserWithIndex: () => ({ id: '1' }), setUserUsage: () => {} },
      '../src/core/utils.js': { startSpinner: () => () => {}, getShortId: () => 'abc123', getArtefactExt: () => 'json', buildDocLabel: () => {}, promptForDocument: async () => null },
      '../src/core/error.js':{ handleApiError: () => { errorCalls++; } },
      '../src/core/db.js':    { db: { insert: () => {}, get: () => [] } }
    });

    const origExit = process.exit;
    process.exit   = () => { exitCalls++; throw new Error('exit'); };

    try { await runDiscovery('9915:test', { env: 'TEST' }); } catch {}

    process.exit = origExit;

    assert.equal(errorCalls, 1);
    assert.ok(exitCalls > 0);
  });
});