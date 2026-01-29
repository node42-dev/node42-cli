const sinon = require("sinon");
const fs = require("fs");
const { expect } = require("chai");


describe("auth", () => {
  describe("login()", () => {
    let login;
    let utils;
    let auth;
    let user;

    beforeEach(() => {
      sinon.restore();

      // fresh require each test
      delete require.cache[require.resolve("../src/utils")];
      delete require.cache[require.resolve("../src/user")];
      delete require.cache[require.resolve("../src/auth")];

      utils = require("../src/utils");
      user = require("../src/user");
      
      sinon.stub(utils, "clearScreen");
      sinon.stub(utils, "ask")
        .onFirstCall().resolves("user")
        .onSecondCall().resolves("secret");

      sinon.stub(utils, "startSpinner").callsFake(() => () => {});
      sinon.stub(user, "getUserInfo").returns({
        userName: "User",
        userMail: "user@test.com",
        role: "user"
      });

      sinon.stub(fs, "mkdirSync");
      sinon.stub(fs, "writeFileSync");

      sinon.stub(console, "log");
      sinon.stub(console, "error");
      sinon.stub(process, "exit").callsFake(() => {
          throw new Error("process.exit");
      });

      auth = require("../src/auth");
      login = auth.login;

      sinon.stub(auth, "checkAuth").returns(true);
    });

    afterEach(() => {
      sinon.restore();
      delete global.fetch;
    });

    it("logs in successfully and writes tokens", async () => {
      // mock fetch
      global.fetch = sinon.stub().resolves({
        ok: true,
        json: async () => ({
          accessToken: "a",
          refreshToken: "r",
          idToken: "i"
        })
      });

      await login();

      expect(fs.mkdirSync.calledOnce).to.be.true;
      expect(fs.writeFileSync.calledOnce).to.be.true;
      expect(console.log.calledWithMatch("Authenticated as")).to.be.true;
    });

    it("exits on http error", async () => {
      global.fetch = sinon.stub().resolves({
        ok: false,
        status: 401,
        json: async () => ({})
      });

      try {
          await login();
      } catch (e) {
          // expected
      }

      expect(console.error.calledWithMatch("Login failed")).to.be.true;
      expect(process.exit.calledWith(1)).to.be.true;
      expect(fs.writeFileSync.called).to.be.false;
    });
  });
});