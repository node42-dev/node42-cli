import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import esmock from 'esmock';

const baseAuth = {
  login:        async () => {},
  logout:       async () => {},
  getMe:        async () => true,
  setApiKey:    () => {},
  getApiKey:    () => {},
  removeApiKey: () => {},
};

const baseMocks = {
  '../src/discover.js':       { runDiscovery: () => {} },
  '../src/validator.js':      { runValidation: () => {} },
  '../src/identity/auth.js':  baseAuth,
  '../src/identity/user.js':  { getUserWithIndex: () => ({ id: '1', userMail: 'test@test.com', userName: 'Test', role: 'user', rateLimits: {}, serviceUsage: {} }), getUserUsage: () => 0 },
  '../src/cli/paths.js':      { getN42Home: () => '/tmp', getUserDiscoveryDir: () => '/tmp', initShellCompletion: () => {}, cleanAppDirs: () => {} },
  '../src/cli/prompt.js':     { validateEnv: () => {}, validateId: () => {} },
  '../src/cli/spinner.js':    { Spinner: class { start() {} done() {} fail() {} } },
  '../src/cli/color.js':      { C: { BOLD: '', RESET: '', RED: '', BLUE: '', DIM: '', GREEN: '', CYAN: '', YELLOW: '' }, c: (_, text) => text },
  '../src/core/utils.js':     { capitalize: (s) => s },
  '../src/db/db.js': { 
    createDb:     () => ({ get: () => [], artefactsByParticipant: () => [] }),
    getDbAdapter: async () => ({}),
  },
  '../src/core/error.js':     { handleError: () => {}, N42Error: class extends Error { constructor(def, vars) { super(vars?.details ?? ''); } pretty() { return this.message; } }, N42ErrorCode: { INVALID_INPUT: {}, DOC_NOT_FOUND: {} } },
  '../src/core/constants.js': { DEFAULT_OUTPUT: 'plantuml', DEFAULT_FORMAT: 'svg' },
};

function makeProgram() {
  const commands = {};

  const makeCmd = (name) => {
    const cmd = {
      description:    () => cmd,
      option:         () => cmd,
      requiredOption: () => cmd,
      argument:       () => cmd,
      action:         (fn) => { commands[name] = fn; return cmd; },
      command:        (sub) => makeCmd(`${name}:${sub.split(' ')[0]}`),
    };
    return cmd;
  };

  const program = {
    command: (name) => makeCmd(name),
    option:  () => program,
  };

  return { program, commands };
}

describe('registerCommands', () => {

  it('registers login command and calls login()', async () => {
    let loginCalled = 0;
    const { program, commands } = makeProgram();
    await esmock.strict('../src/commands.js', {
      ...baseMocks,
      '../src/identity/auth.js': { ...baseAuth, login: async () => { loginCalled++; } },
    }).then(m => m.registerCommands(program));
    await commands['login']();
    assert.equal(loginCalled, 1);
  });

  it('registers logout command and calls logout()', async () => {
    let logoutCalled = 0;
    const { program, commands } = makeProgram();
    await esmock.strict('../src/commands.js', {
      ...baseMocks,
      '../src/identity/auth.js': { ...baseAuth, logout: async () => { logoutCalled++; } },
    }).then(m => m.registerCommands(program));
    await commands['logout']();
    assert.equal(logoutCalled, 1);
  });

  it('registers discover:peppol and calls runDiscovery', async () => {
    let discoverArgs = null;
    const { program, commands } = makeProgram();
    await esmock.strict('../src/commands.js', {
      ...baseMocks,
      '../src/discover.js': { runDiscovery: (id, opts) => { discoverArgs = [id, opts]; } },
    }).then(m => m.registerCommands(program));
    commands['discover:peppol']('9915:123456789', { env: 'TEST', output: 'json', format: 'json' });
    assert.ok(discoverArgs !== null);
    assert.equal(discoverArgs[0], '9915:123456789');
  });

  it('registers validate:peppol and calls runValidation', async () => {
    let validationArgs = null;
    const { program, commands } = makeProgram();

    const tmpFile = '/tmp/test-invoice.xml';
    const { writeFileSync } = await import('fs');
    writeFileSync(tmpFile, '<Invoice/>');

    await esmock.strict('../src/commands.js', {
      ...baseMocks,
      '../src/validator.js': { runValidation: (name, doc, opts) => { validationArgs = [name, doc, opts]; } },
    }).then(m => m.registerCommands(program));

    commands['validate:peppol'](tmpFile, { ruleset: 'current', location: true, runtime: false });
    assert.ok(validationArgs !== null);
    assert.ok(validationArgs[1].includes('<Invoice/>'));
  });

  it('validate:peppol exits if document not found', async () => {
    let exitCalled = false;
    const { program, commands } = makeProgram();
    const origExit = process.exit;
    process.exit = () => { exitCalled = true; };

    await esmock.strict('../src/commands.js', baseMocks)
      .then(m => m.registerCommands(program));

    commands['validate:peppol']('/tmp/nonexistent.xml', { ruleset: 'current' });
    process.exit = origExit;
    assert.ok(exitCalled);
  });

  it('discover:peppol exits on invalid env', async () => {
    let exitCalled = false;
    const { program, commands } = makeProgram();
    const origExit = process.exit;
    process.exit = () => { exitCalled = true; };

    await esmock.strict('../src/commands.js', {
      ...baseMocks,
      '../src/cli/prompt.js': {
        validateEnv: (env) => { if (env === 'INVALID') throw new Error('bad env'); },
        validateId:  () => {},
      },
    }).then(m => m.registerCommands(program));

    commands['discover:peppol']('9915:123456789', { env: 'INVALID' });
    process.exit = origExit;
    assert.ok(exitCalled);
  });

  it('registers clean command', async () => {
    let cleanCalled = false;
    const { program, commands } = makeProgram();
    await esmock.strict('../src/commands.js', {
      ...baseMocks,
      '../src/cli/paths.js': { ...baseMocks['../src/cli/paths.js'], cleanAppDirs: () => { cleanCalled = true; } },
    }).then(m => m.registerCommands(program));
    commands['clean']({});
    assert.ok(cleanCalled);
  });

  it('registers completion command and throws on non-bash shell', async () => {
    const { program, commands } = makeProgram();
    await esmock.strict('../src/commands.js', baseMocks)
      .then(m => m.registerCommands(program));
    assert.throws(() => commands['completion']('zsh'));
  });

});