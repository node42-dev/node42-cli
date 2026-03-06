import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs   from 'fs';
import path from 'path';
import os   from 'os';

const TEST_ROOT = path.join(os.tmpdir(), 'node42-utils-test');

const { db }                            = await import('../src/core/db.js');
const { capitalize, getShortId, getArtefactExt, validateEnv, validateId, buildDocLabel, createAppDirs, cleanAppDirs } = await import('../src/core/utils.js');
const config                            = await import('../src/core/config.js');

describe('utils', () => {

  beforeEach(() => {
    if (fs.existsSync(TEST_ROOT)) fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  afterEach(() => {
    mock.restoreAll();
    if (fs.existsSync(TEST_ROOT)) fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  /* ---------- PURE HELPERS ---------- */

  it('capitalizes string', () => {
    assert.equal(capitalize('test'), 'Test');
  });

  it('returns short id', () => {
    assert.equal(getShortId('1234567890'), '12345678');
  });

  it('returns artefact extension', () => {
    assert.equal(getArtefactExt('plantuml', 'svg'),  'svg');
    assert.equal(getArtefactExt('plantuml', 'text'), 'puml');
    assert.equal(getArtefactExt('json'),              'json');
  });

  /* ---------- VALIDATION ---------- */

  it('validates environment', () => {
    assert.doesNotThrow(() => validateEnv('TEST'));
    assert.doesNotThrow(() => validateEnv('prod'));
    assert.throws(() => validateEnv('BAD'));
  });

  it('validates participant id', () => {
    assert.doesNotThrow(() => validateId('participant', '9915:abc123'));
    assert.throws(() => validateId('participant', 'bad-id'));
  });

  /* ---------- buildDocLabel ---------- */

  describe('buildDocLabel()', () => {
    it('formats wildcard invoice', () => {
      const doc = {
        scheme: 'peppol-doctype-wildcard',
        value:  'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##*'
      };
      assert.equal(buildDocLabel(doc), 'Any Invoice (Wildcard)');
    });

    it('formats BIS invoice', () => {
      const doc = {
        scheme: 'busdox-docid-qns',
        value:  'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017'
      };
      assert.equal(buildDocLabel(doc), 'Invoice (BIS 3)');
    });

    it("falls back on 'unknown' value", () => {
      const doc = { scheme: 'busdox-docid-qns', value: 'unknown' };
      assert.equal(buildDocLabel(doc), 'Document');
    });
  });

  /* ---------- FS / SIDE EFFECTS ---------- */

  it('creates application directories and config', () => {
    createAppDirs(true);
    assert.ok(fs.existsSync(config.default.node42Home));
    assert.ok(fs.existsSync(config.default.artefactsDir));
    assert.ok(fs.existsSync(config.default.configFile));
  });

  it('cleans artefacts directory', (t) => {
    fs.mkdirSync(config.default.artefactsDir, { recursive: true });
    fs.writeFileSync(path.join(config.default.artefactsDir, 'x'), 'x');

    t.mock.method(db, 'clear', () => {});

    cleanAppDirs({ artefacts: true });

    assert.ok(fs.existsSync(config.default.artefactsDir));
    assert.equal(fs.readdirSync(config.default.artefactsDir).length, 0);
  });

  it('prints message when nothing to clean', (t) => {
    const logSpy = t.mock.method(console, 'log', () => {});

    cleanAppDirs({});

    assert.ok(logSpy.mock.calls.some(c => String(c.arguments[0]).includes('Nothing to clean')));
  });
});