import { describe, it } from 'node:test';
import assert  from 'node:assert/strict';
import esmock  from 'esmock';

const baseAuth = {
  login: async () => {}, logout: async () => {}, getMe: async () => true,
  fetchWithAuth: async () => {}, setApiKey: () => {}, getApiKey: () => {}, removeApiKey: () => {}
};

const baseMocks = {
  '../src/discover.js':       { runDiscovery: () => {} },
  '../src/validator.js':      { runValidation: () => {} },
  '../src/identity/user.js':  { getUserWithIndex: () => ({ id: '1' }), getUserUsage: () => 0 },
  '../src/cli/paths.js':      { N42_HOME: '/tmp', getUserDiscoveryDir: () => '/tmp', initWorkspace: () => {}, createAppDirs: () => {}, cleanAppDirs: () => {} },
  '../src/cli/prompt.js':     { validateEnv: () => {}, validateId: () => {} },
  '../src/core/utils.js':     { capitalize: (s) => s },
  '../src/core/db.js':        { db: { get: () => [], artefactsByParticipant: () => [] } },
  '../src/core/error.js':     { handleApiError: () => {},  N42Error: class extends Error {}, N42ErrorCode: {} },
  '../src/cli/color.js':      { C: { BOLD: '', RESET: '', RED: '', BLUE: '', DIM: '', GREEN: '', CYAN: '', YELLOW: '' }, c: (col, text) => text },
  '../src/core/constants.js': { APP_NAME: 'n42', DEFAULT_OUTPUT: 'plantuml', DEFAULT_FORMAT: 'svg' }
};

function makeProgramMock(argv, handlers = {}) {
  const commands = {};

  const makeCmd = (name) => {
    const cmd = {
      description: () => cmd,
      option:      () => cmd,
      action:      (fn) => { commands[name] = fn; return cmd; },
      command: (sub) => {
        const clean = sub.split(' ')[0];
        return makeCmd(name ? `${name}:${clean}` : clean);
      }
    };
    return cmd;
  };

  const program = {
    name:        () => program,
    description: () => program,
    version:     () => program,
    command:     (name) => makeCmd(name),
    option:      () => program,
    parse: (args) => {
      const cmd  = args[2];
      const sub  = args[3];

      if (commands[cmd]) {
        commands[cmd]();
        return;
      }

      const key = `${cmd}:${sub}`;

      if (commands[key]) {
        const id = args[4];

        const envIdx = args.indexOf('--env');
        const env    = envIdx >= 0 ? args[envIdx + 1] : 'TEST';

        commands[key](id, { env, output: 'json', format: 'json' });
      }
    }
  };

  return { program };
}

describe('CLI', () => {

  it('runs login command', async () => {
    let loginCalled = 0;
    process.argv = ['node', 'n42', 'login'];
    await esmock.strict('../src/cli.js', {
      ...baseMocks,
      '../src/identity/auth.js': { ...baseAuth, login: async () => { loginCalled++; } },
      'commander':      makeProgramMock(process.argv)
    });
    assert.ok(loginCalled > 0);
  });

  it('runs logout command', async () => {
    let logoutCalled = 0;
    process.argv = ['node', 'n42', 'logout'];
    await esmock.strict('../src/cli.js', {
      ...baseMocks,
      '../src/identity/auth.js': { ...baseAuth, logout: async () => { logoutCalled++; } },
      'commander':      makeProgramMock(process.argv)
    });
    assert.ok(logoutCalled > 0);
  });

  it('runs peppol discovery', async () => {
    let discoverArgs = null;
    process.argv = ['node', 'n42', 'discover', 'peppol', '9915:123456789', '--env', 'TEST'];
    await esmock.strict('../src/cli.js', {
      ...baseMocks,
      '../src/identity/auth.js':    baseAuth,
      '../src/discover.js':{ runDiscovery: (id, opts) => { discoverArgs = [id, opts]; } },
      'commander':         makeProgramMock(process.argv)
    });
    assert.ok(discoverArgs !== null);
    assert.equal(discoverArgs[0], '9915:123456789');
  });

  it('exits on invalid env', async () => {
    let exitCalled = false;
    process.argv   = ['node', 'n42', 'discover', 'peppol', '9915:123456789', '--env', 'INVALID'];
    const origExit = process.exit;
    process.exit   = () => { exitCalled = true; throw new Error('exit'); };
    try {
      await esmock.strict('../src/cli.js', {
        ...baseMocks,
        '../src/identity/auth.js':  baseAuth,
        '../src/cli/prompt.js': { ...baseMocks['../src/cli/prompt.js'], validateEnv: (env) => { if (env === 'INVALID') { process.exit(1); } } },
        'commander':       makeProgramMock(process.argv)
      });
    } catch {}
    process.exit = origExit;
    assert.ok(exitCalled);
  });
});