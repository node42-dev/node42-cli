const { expect } = require("chai");
const sinon = require("sinon");
const fs = require("fs");
const path = require("path");
const os = require("os");

const config = require("../src/config");
const db = require("../src/db");

const TEST_ROOT = path.join(os.tmpdir(), "node42-utils-test");

describe("utils", () => {
  let utils;

  beforeEach(() => {
    sinon.restore();

    // isolate fs paths
    sinon.stub(config, "NODE42_DIR").value(TEST_ROOT);
    sinon.stub(config, "ARTEFACTS_DIR").value(path.join(TEST_ROOT, "artefacts"));
    sinon.stub(config, "TRANSACTIONS_DIR").value(path.join(TEST_ROOT, "transactions"));
    sinon.stub(config, "VALIDATIONS_DIR").value(path.join(TEST_ROOT, "validations"));
    sinon.stub(config, "CONFIG_FILE").value(path.join(TEST_ROOT, "config.json"));
    sinon.stub(config, "TOKENS_FILE").value(path.join(TEST_ROOT, "tokens.json"));
    sinon.stub(config, "DATABASE_FILE").value(path.join(TEST_ROOT, "db.json"));

    if (fs.existsSync(TEST_ROOT)) {
      fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    }

    delete require.cache[require.resolve("../src/utils")];
    utils = require("../src/utils");
  });

  afterEach(() => {
    sinon.restore();
    if (fs.existsSync(TEST_ROOT)) {
      fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    }
  });

  /* ---------- PURE HELPERS ---------- */

  it("capitalizes string", () => {
    expect(utils.capitalize("test")).to.equal("Test");
  });

  it("returns short id", () => {
    expect(utils.getShortId("1234567890")).to.equal("12345678");
  });

  it("returns artefact extension", () => {
    expect(utils.getArtefactExt("plantuml", "svg")).to.equal("svg");
    expect(utils.getArtefactExt("plantuml", "text")).to.equal("puml");
    expect(utils.getArtefactExt("json")).to.equal("json");
  });

  /* ---------- VALIDATION ---------- */

  it("validates environment", () => {
    expect(() => utils.validateEnv("TEST")).to.not.throw();
    expect(() => utils.validateEnv("prod")).to.not.throw();
    expect(() => utils.validateEnv("BAD")).to.throw();
  });

  it("validates participant id", () => {
    expect(() => utils.validateId("participant", "9915:abc123")).to.not.throw();
    expect(() => utils.validateId("participant", "bad-id")).to.throw();
  });

  /* ---------- buildDocLabel ---------- */

  describe("buildDocLabel()", () => {
    it("formats wildcard invoice", () => {
      const doc = {
        scheme: "peppol-doctype-wildcard",
        value: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##*"
      };

      expect(utils.buildDocLabel(doc)).to.equal("Any Invoice (Wildcard)");
    });

    it("formats BIS invoice", () => {
      const doc = {
        scheme: "busdox-docid-qns",
        value: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017"
      };

      expect(utils.buildDocLabel(doc)).to.equal("Invoice (BIS 3)");
    });

    it("falls back on 'unknown' value", () => {
      const doc = { scheme: "busdox-docid-qns", value: "unknown" };
      expect(utils.buildDocLabel(doc)).to.equal("Document");
    });
  });

  /* ---------- FS / SIDE EFFECTS ---------- */

  it("creates application directories and config", () => {
    utils.createAppDirs(true);

    expect(fs.existsSync(config.NODE42_DIR)).to.be.true;
    expect(fs.existsSync(config.ARTEFACTS_DIR)).to.be.true;
    expect(fs.existsSync(config.CONFIG_FILE)).to.be.true;
  });

  it("cleans artefacts directory", () => {
    fs.mkdirSync(config.ARTEFACTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(config.ARTEFACTS_DIR, "x"), "x");

    sinon.stub(db, "clear");

    utils.cleanAppDirs({ artefacts: true });

    expect(fs.existsSync(config.ARTEFACTS_DIR)).to.be.true;
    expect(fs.readdirSync(config.ARTEFACTS_DIR)).to.have.length(0);
  });

  it("prints message when nothing to clean", () => {
    sinon.stub(console, "log");

    utils.cleanAppDirs({});

    expect(console.log.calledWithMatch("Nothing to clean")).to.be.true;
  });
});
