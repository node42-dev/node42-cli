const { expect } = require("chai");
const sinon = require("sinon");
const fs = require("fs");
const path = require("path");

describe("runDiscovery()", () => {
  let runDiscovery;
  let auth, user, utils, errors, db, config;

  beforeEach(() => {
    sinon.restore();

    // ---- load modules FIRST ----
    auth = require("../src/auth");
    user = require("../src/user");
    utils = require("../src/utils");
    errors = require("../src/errors");
    db = require("../src/db");
    config = require("../src/config");

    // ---- stub config constants ----
    sinon.stub(config, "ARTEFACTS_DIR").value("/tmp/node42-artefacts");
    sinon.stub(config, "NODE42_DIR").value("/tmp/node42");
    sinon.stub(config, "API_URL").value("https://api.example.com");
    sinon.stub(config, "EP_DISCOVER").value("discover");

    // ---- fs ----
    const realRead = fs.readFileSync;
    sinon.stub(fs, "writeFileSync");
    sinon.stub(fs, "readFileSync").callsFake((file, enc) => {
      if (file.includes("wrapper.html.template")) {
        return "<!-- SVG --><!-- TIME -->/--UUID--/";
      }
      return realRead(file, enc);
    });

    // ---- utils ----
    sinon.stub(utils, "startSpinner").returns(() => {});
    sinon.stub(utils, "getShortId").returns("abc123");
    sinon.stub(utils, "getArtefactExt").returns("json");
    sinon.stub(utils, "buildDocLabel");
    sinon.stub(utils, "promptForDocument").resolves(null);

    // ---- auth ----
    sinon.stub(auth, "fetchWithAuth").resolves({
      ok: true,
      headers: {
        get: (k) => ({
          "X-Node42-RefId": "ref-123",
          "X-Node42-ServiceUsage": "1",
          "X-Node42-RateLimit": "100/100",
          "X-Node42-Documents": null
        }[k])
      },
      json: async () => ({ result: "ok" })
    });

    // ---- user ----
    sinon.stub(user, "getUserWithIndex").returns({ id: "1" });
    sinon.stub(user, "setUserUsage");

    // ---- db ----
    sinon.stub(db, "insert");

    sinon.stub(console, "log");

    // ---- require AFTER stubbing ----
    delete require.cache[require.resolve("../src/discover")];
    runDiscovery = require("../src/discover").runDiscovery;
  });

  afterEach(() => sinon.restore());

  it("runs discovery and writes json artefact", async () => {
    await runDiscovery("9915:test", {
      env: "TEST",
      output: "json",
      format: "json"
    });

    expect(auth.fetchWithAuth.calledOnce).to.be.true;
    expect(db.insert.calledOnce).to.be.true;
    expect(fs.writeFileSync.called).to.be.true;
    expect(user.setUserUsage.calledOnce).to.be.true;
  });

  it("handles API error response", async () => {
    sinon.restore();

    // stub error path BEFORE require
    const auth = require("../src/auth");
    const errors = require("../src/errors");

    sinon.stub(auth, "fetchWithAuth").resolves({
        ok: false,
        json: async () => ({ code: "N42E-5000", message: "fail" })
    });

    sinon.stub(errors, "handleError");
    sinon.stub(process, "exit").throws(new Error("exit"));

    delete require.cache[require.resolve("../src/discover")];
    const runDiscovery = require("../src/discover").runDiscovery;

    try {
        await runDiscovery("9915:test", { env: "TEST" });
    } catch {}

    expect(errors.handleError.calledOnce).to.be.true;
    expect(process.exit.calledOnce).to.be.true;
  });
});