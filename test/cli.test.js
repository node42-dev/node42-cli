const { expect } = require("chai");
const sinon = require("sinon");

describe("CLI", () => {
  let login, logout, runDiscovery;

  beforeEach(() => {
    sinon.restore();

    // stub process.exit so tests don’t quit
    sinon.stub(process, "exit").callsFake(() => {
      throw new Error("process.exit");
    });

    // stub handlers
    login = sinon.stub().resolves();
    logout = sinon.stub().resolves();
    runDiscovery = sinon.stub();

    // stub requires BEFORE loading CLI
    sinon.stub(require("../src/auth"), "login").callsFake(login);
    sinon.stub(require("../src/auth"), "logout").callsFake(logout);
    sinon.stub(require("../src/discover"), "runDiscovery").callsFake(runDiscovery);
  });

  afterEach(() => {
    sinon.restore();
    delete require.cache[require.resolve("../src/cli")];
  });

  it("runs login command", async () => {
    process.argv = ["node", "n42", "login"];

    require("../src/cli");

    expect(login.calledOnce).to.be.true;
  });

  it("runs logout command", async () => {
    process.argv = ["node", "n42", "logout"];

    require("../src/cli");

    expect(logout.calledOnce).to.be.true;
  });

  it("runs peppol discovery", () => {
    process.argv = [
      "node",
      "n42",
      "discover",
      "peppol",
      "9915:123456789",
      "--env",
      "TEST"
    ];

    require("../src/cli");

    expect(runDiscovery.calledOnce).to.be.true;
    expect(runDiscovery.firstCall.args[0]).to.equal("9915:123456789");
  });

  it("exits on invalid env", () => {
    process.argv = [
      "node",
      "n42",
      "discover",
      "peppol",
      "9915:123456789",
      "--env",
      "INVALID"
    ];

    try {
      require("../src/cli");
    } catch (e) {
      // expected
    }

    expect(process.exit.called).to.be.true;
  });
});