const { expect } = require("chai");
const sinon = require("sinon");
const fs = require("fs");
const path = require("path");
const os = require("os");

const db = require("../src/db");

const TEST_DB = path.join(os.tmpdir(), "test-db-user.json");

describe("user", () => {
  let user;

  beforeEach(() => {
    sinon.restore();

    db.setSource(TEST_DB);
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

    // fresh require
    delete require.cache[require.resolve("../src/user")];
    user = require("../src/user");
  });

  afterEach(() => {
    sinon.restore();
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  it("returns default user when index does not exist", () => {
    const u = user.getUserWithIndex(0);

    expect(u.id).to.equal("n/a");
    expect(u.userName).to.equal("n/a");
  });

  it("returns user by index when present", () => {
    db.save({
      user: [{
        id: "1",
        userName: "User",
        userMail: "user@test.com",
        role: "user"
      }]
    });

    const u = user.getUserWithIndex(0);
    expect(u.id).to.equal("1");
  });

  it("returns user by id when present", () => {
    db.save({
      user: [{
        id: "1",
        userName: "User",
        userMail: "user@test.com",
        role: "user"
      }]
    });

    const u = user.getUserWithId("1");
    expect(u.userMail).to.equal("user@test.com");
  });

  it("returns default user when id is missing", () => {
    const u = user.getUserWithId("missing");
    expect(u.id).to.equal("n/a");
  });

  it("returns undefined usage when none exists", () => {
    db.save({
      user: [{
        id: "1",
        serviceUsage: {}
      }]
    });

    const usage = user.getUserUsage("1", "discovery", "2026-02");
    expect(usage).to.be.undefined;
  });

  it("sets and retrieves service usage", () => {
    db.save({
      user: [{
        id: "1",
        serviceUsage: {}
      }]
    });

    user.setUserUsage("1", "discovery", "2026-02", 5);

    const usage = user.getUserUsage("1", "discovery", "2026-02");
    expect(usage).to.equal(5);
  });

  it("does nothing when setting usage for missing user", () => {
    const spy = sinon.spy(db, "save");

    user.setUserUsage("missing", "discovery", "2026-02", 5);

    expect(spy.called).to.be.false;
  });
});