const { expect } = require("chai");
const sinon = require("sinon");
const fs = require("fs");
const path = require("path");
const os = require("os");
const db = require("../src/db");

const TEST_DB = path.join(os.tmpdir(), "test-db.json");

describe("auth", () => {
  describe("login()", () => {
    let login;
    let utils;
    let auth;
    let user;

    beforeEach(() => {
      sinon.restore();

      global.fetch = sinon.stub();
     
      db.setSource(TEST_DB);
      if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

      // fresh require each test
      delete require.cache[require.resolve("../src/utils")];
      delete require.cache[require.resolve("../src/user")];
      delete require.cache[require.resolve("../src/auth")];

      utils = require("../src/utils");
      user = require("../src/user");
      
      //sinon.stub(utils, "writeHeader");
      sinon.stub(utils, "ask")
        .onFirstCall().resolves("user")
        .onSecondCall().resolves("secret");

      sinon.stub(utils, "startSpinner").callsFake(() => () => {});
      sinon.stub(user, "getUserWithIndex")
      .withArgs(0)
      .returns({
        id: "1",
        userName: "User",
        userMail: "user@test.com",
        role: "user",
      });

      sinon.spy(fs, "mkdirSync");
      sinon.spy(fs, "writeFileSync");

      sinon.stub(console, "log");
      sinon.stub(console, "error");
      sinon.stub(process, "exit").callsFake(() => {
          throw new Error("process.exit");
      });

      auth = require("../src/auth");
      login = auth.login;

      sinon.stub(auth, "checkAuth").resolves(true);
    });

    afterEach(() => {
      sinon.restore();
      delete global.fetch;
    });

    it("logs in successfully and writes tokens", async () => {
      // mock fetch
      global.fetch.resolves({
        ok: true,
        json: async () => ({
          accessToken: "a",
          refreshToken: "r",
          idToken: "i"
        })
      });

      await login();

      expect(fs.writeFileSync.called).to.be.true;
      expect(console.log.calledWithMatch("Authenticated as")).to.be.true;
    });

    it("exits on http error", async () => {
      global.fetch.resolves({
        ok: false,
        status: 401,
        json: async () => ({})
      });

      try {
          await login();
      } catch (e) {
          // expected
      }

      expect(console.error.calledWithMatch("Signin failed")).to.be.true;
      expect(process.exit.calledWith(1)).to.be.true;
      expect(fs.writeFileSync.called).to.be.false;
    });
  });
});