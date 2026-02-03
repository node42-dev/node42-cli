const { expect } = require("chai");
const sinon = require("sinon");

const utils = require("../src/utils");
const errors = require("../src/errors");

describe("runValidation()", () => {
  let validator;
  let fetchStub;
  let spinnerStub;
  let handleErrorStub;
  let exitStub;

  beforeEach(() => {
    sinon.restore();

    delete require.cache[require.resolve("../src/auth")];
    delete require.cache[require.resolve("../src/validator")];

    const auth = require("../src/auth");
    fetchStub = sinon.stub(auth, "fetchWithAuth").resolves({
      ok: true,
      json: async () => ({ sections: [] })
    });

    handleErrorStub = sinon.stub(errors, "handleError").resolves();
    spinnerStub = sinon.stub(utils, "startSpinner").returns(() => {});
    exitStub = sinon.stub(process, "exit").throws(new Error("exit"));

    validator = require("../src/validator");
  });

  afterEach(() => sinon.restore());

  it("sends XML to validator endpoint and handles successful response", async () => {
    await validator.runValidation(
      "Invoice.xml",
      "<xml></xml>",
      { ruleset: "current" }
    );

    expect(fetchStub.calledOnce).to.equal(true);
    expect(handleErrorStub.notCalled).to.equal(true);
    expect(exitStub.notCalled).to.equal(true);
  });

  it("handles validator error response and exits", async () => {
    fetchStub.resolves({
      ok: false,
      status: 400,
      json: async () => ({ code: "VALIDATION_FAILED" })
    });

    try {
      await validator.runValidation(
        "Invoice.xml",
        "<xml></xml>",
        { ruleset: "current" }
      );
    } catch {}

    expect(fetchStub.calledOnce).to.equal(true);
    expect(handleErrorStub.calledOnce).to.equal(true);
    expect(process.exit.calledWith(1)).to.be.true;
  });
});
