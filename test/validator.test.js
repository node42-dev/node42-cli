import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';
import fs     from 'fs';

describe('runValidation()', () => {

  it('sends XML to validator endpoint and handles successful response', async () => {
    let fetchCalls = 0;
    let errorCalls = 0;
    let exitCalls  = 0;

    const { runValidation } = await esmock('../src/validator.js', {
      '../src/identity/auth.js':   { fetchWithAuth: async () => { fetchCalls++; return { ok: true, json: async () => ({ sections: [] }) }; } },
      '../src/cli/spinner.js': { Spinner: class { start() {} update() {} done() {} fail() {} } },
      '../src/core/error.js': { handleApiError: () => { errorCalls++; } },
      '../src/core/constants.js': { VALIDATOR_URL: 'https://validator.example.com', EP_VALIDATE: 'validate' },
      '../src/cli/paths.js':      { getUserValidationsDir: () => '/tmp', N42_HOME: '/tmp' },
      'fs': { ...fs, writeFileSync: () => {}, readFileSync: (f, e) => f.includes('template') ? '<html><!-- XML --><!-- TIME -->/--UUID--/</html>' : fs.readFileSync(f, e) }
    });

    const origExit = process.exit;
    process.exit   = () => { exitCalls++; throw new Error('exit'); };

    await runValidation('Invoice.xml', '<xml></xml>', { ruleset: 'current' });

    process.exit = origExit;

    assert.equal(fetchCalls, 1);
    assert.equal(errorCalls, 0);
    assert.equal(exitCalls,  0);
  });

  it('handles validator error response and exits', async () => {
    let fetchCalls = 0;
    let errorCalls = 0;
    let exitCalls  = 0;

    const { runValidation } = await esmock('../src/validator.js', {
      '../src/identity/auth.js': { fetchWithAuth: async () => { fetchCalls++; return { ok: false, status: 400, json: async () => ({ code: 'VALIDATION_FAILED' }) }; } },
      '../src/cli/spinner.js': { Spinner: class { start() {} update() {} done() {} fail() {} } },
      '../src/core/error.js':    { handleApiError: () => { errorCalls++; } }
    });

    const origExit = process.exit;
    process.exit   = (code) => { exitCalls++; throw new Error('exit'); };

    try { await runValidation('Invoice.xml', '<xml></xml>', { ruleset: 'current' }); } catch {}

    process.exit = origExit;

    assert.equal(fetchCalls, 1);
    assert.equal(errorCalls, 1);
    assert.ok(exitCalls > 0);
  });
});