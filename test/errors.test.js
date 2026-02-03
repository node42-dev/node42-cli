const { expect } = require("chai");
const sinon = require("sinon");

const config = require("../src/config");
const { handleError } = require("../src/errors");

describe("handleError()", () => {
  let errorStub;

  beforeEach(() => {
    sinon.restore();
    sinon.stub(console, "error");
    errorStub = sinon.stub(config, "WWW_URL").value("https://example.com");
  });

  afterEach(() => {
    sinon.restore();
  });

  it("prints formatted error with code and message", () => {
    handleError({
      code: "N42E-5101",
      message: "Rate limit exceeded"
    });

    expect(console.error.called).to.be.true;
    expect(console.error.firstCall.args[0]).to.include("Error: 5101");
    expect(console.error.firstCall.args[0]).to.include("Rate limit exceeded");
    expect(console.error.firstCall.args[0]).to.include("View Details");
  });

  it("prints error without message using documentation fallback", () => {
    handleError({
      code: "N42E-9032"
    });

    expect(console.error.called).to.be.true;
    expect(console.error.firstCall.args[0]).to.include("Error: 9032");
    expect(console.error.firstCall.args[0]).to.include("For details, see the documentation");
  });

  it("handles error without N42E prefix", () => {
    handleError({
      code: "UNKNOWN",
      message: "Something failed"
    });

    expect(console.error.called).to.be.true;
    expect(console.error.firstCall.args[0]).to.include("Error:");
    expect(console.error.firstCall.args[0]).to.include("Something failed");
  });

  it("handles error without code", () => {
    handleError({
      message: "Generic failure"
    });

    expect(console.error.called).to.be.true;
    expect(console.error.firstCall.args[0]).to.include("Generic failure");
  });
});
