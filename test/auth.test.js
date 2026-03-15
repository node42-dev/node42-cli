import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs     from 'fs';
import path   from 'path';
import os     from 'os';
import esmock from 'esmock';
import { createJsonFileAdapter } from '../src/db/adapters/cli.json.db.js';
import { createDb }              from '../src/db/db.js';

const TEST_DB = path.join(os.tmpdir(), 'n42-auth-test-db.json');

let db;

describe('auth', () => {
  describe('login()', () => {

    beforeEach(() => {
      if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
      db = createDb(createJsonFileAdapter(TEST_DB));
    });

    afterEach(() => {
      delete global.fetch;
      if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    });

    it('logs in successfully and writes tokens', async () => {
      let writeFileCalls = 0;
      let logCalls       = [];

      global.fetch = async (url) => {
        if (url.includes('signin')) return {
          ok:   true,
          json: async () => ({ accessToken: 'a', refreshToken: 'r', idToken: 'i' })
        };
        return {
          ok:   true,
          json: async () => ({
            sub:          '1',
            userName:     'User',
            userMail:     'user@test.com',
            role:         'user',
            rateLimits:   {},
            serviceUsage: {}
          })
        };
      };

      const auth = await esmock('../src/identity/auth.js', {
        '../src/db/db.js': { createDb: () => db, indexBy: () => {}, indexByFn: () => {} },
        '../src/db/adapters/cli.json.db.js': { createJsonFileAdapter: () => createJsonFileAdapter(TEST_DB) },
        '../src/cli/prompt.js': {
          ask:          async (q) => q.includes('Password') ? 'secret' : 'user',
          startSpinner: () => () => {}
        },
        '../src/identity/user.js': {
          getUserWithIndex: () => ({ id: '1', userName: 'User', userMail: 'user@test.com', role: 'user' })
        },
        'fs': {
          ...fs,
          mkdirSync:     () => {},
          writeFileSync: (...args) => { writeFileCalls++; },
          readFileSync:  (f, enc) => {
            if (String(f).includes('tokens')) return JSON.stringify({ accessToken: 'a', refreshToken: 'r', idToken: 'i' });
            return fs.readFileSync(f, enc);
          },
          existsSync: (f) => {
            if (String(f).includes('tokens')) return true;
            return fs.existsSync(f);
          }
        }
      });

      const origLog = console.log;
      console.log   = (...args) => logCalls.push(args);
      await auth.login();
      console.log = origLog;

      assert.ok(writeFileCalls > 0);
      assert.ok(logCalls.some(a => String(a[0]).includes('Logged in as')));
    });

    it('throws on http error', async () => {
      global.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });

      let writeCalls = 0;

      const auth = await esmock('../src/identity/auth.js', {
        '../src/db/db.js': { createDb: () => db, indexBy: () => {}, indexByFn: () => {} },
        '../src/db/adapters/cli.json.db.js': { createJsonFileAdapter: () => createJsonFileAdapter(TEST_DB) },
        '../src/cli/prompt.js': {
          ask:          async (q) => q.includes('Password') ? 'secret' : 'user',
          startSpinner: () => () => {}
        },
        '../src/identity/user.js': {
          getUserWithIndex: () => ({ id: '1', userName: 'User', userMail: 'user@test.com', role: 'user' })
        },
        '../src/core/error.js': {
          N42Error:       class extends Error {},
          N42ErrorCode:   {},
          handleApiError: () => {}
        },
        'fs': {
          ...fs,
          mkdirSync:     () => {},
          writeFileSync: () => { writeCalls++; },
          readFileSync:  (f, enc) => {
            if (String(f).includes('tokens')) return JSON.stringify({ accessToken: 'a', refreshToken: 'r', idToken: 'i' });
            return fs.readFileSync(f, enc);
          },
          existsSync: (f) => {
            if (String(f).includes('tokens')) return true;
            return fs.existsSync(f);
          }
        }
      });

      await assert.rejects(() => auth.login(), Error);
      assert.equal(writeCalls, 0);
    });
  });
});