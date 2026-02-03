const { expect } = require("chai");
const sinon = require("sinon");
const fs = require("fs");
const path = require("path");
const os = require("os");
const db = require("../src/db");

describe("db", () => {
  const TEST_DB = path.join(os.tmpdir(), "test-db.json");

  beforeEach(() => {
    // override DB path for tests
    db.setSource(TEST_DB);
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    if (fs.existsSync(TEST_DB + ".tmp")) fs.unlinkSync(TEST_DB + ".tmp");
  });

  describe("load()", () => {
    it("returns default structure when file missing", () => {
      const dbObj = db.load();
      expect(dbObj).to.have.property("user");
      expect(dbObj).to.have.property("artefacts");
    });
  });

  describe("insert() & getCollection()", () => {
    it("inserts and retrieves artefact", () => {
      db.insert("artefacts", {
        id: "1",
        participantId: "0007:123"
      });

      const artefacts = db.get("artefacts");
      expect(artefacts.length).to.equal(1);
      expect(artefacts[0].id).to.equal("1");
    });
  });

  describe("find()", () => {
    it("filters by predicate", () => {
      db.insert("artefacts", { id: "1", participantId: "A" });
      db.insert("artefacts", { id: "2", participantId: "B" });

      const result = db.find("artefacts", x => x.participantId === "A");
      expect(result.length).to.equal(1);
      expect(result[0].id).to.equal("1");
    });
  });

  describe("indexBy()", () => {
    it("indexes by key", () => {
      const list = [
        { id: "1", participantId: "A" },
        { id: "2", participantId: "A" },
        { id: "3", participantId: "B" }
      ];

      const idx = db.indexBy(list, "participantId");

      expect(idx["A"].length).to.equal(2);
      expect(idx["B"].length).to.equal(1);
    });
  });

  describe("indexByFn()", () => {
    it("groups by derived key", () => {
      const list = [
        { id: 1, date: "2026-01-01" },
        { id: 2, date: "2026-01-01" },
        { id: 3, date: "2026-01-02" }
      ];

      const idx = db.indexByFn(list, x => x.date);
      expect(idx["2026-01-01"].length).to.equal(2);
    });
  });

  describe("save()", () => {
    it("writes file atomically", () => {
      db.save({ artefacts: [] });
      expect(fs.existsSync(TEST_DB)).to.be.true;
    });

    it("doesn't corrupt original file if rename fails", () => {
      const original = { artefacts: [{ id: 1 }] };
      db.save(original);

      // stub rename to simulate crash
      const stub = sinon.stub(fs, "renameSync").throws(new Error("fail"));

      try {
        db.save({ artefacts: [{ id: 2 }] });
      } catch (e) {
        // expected
      }

      stub.restore();

      // original file should still be valid JSON
      const content = JSON.parse(fs.readFileSync(TEST_DB, "utf8"));
      expect(content.artefacts[0].id).to.equal(1);
    });
  });

  describe("upsert()", () => {
    it("inserts new item if id does not exist", () => {
      db.upsert("artefacts", { id: "1", name: "A" });

      const list = db.get("artefacts");
      expect(list.length).to.equal(1);
      expect(list[0].name).to.equal("A");
    });

    it("updates existing item if id exists", () => {
      db.upsert("artefacts", { id: "1", name: "A" });
      db.upsert("artefacts", { id: "1", name: "B" });

      const list = db.get("artefacts");

      expect(list.length).to.equal(1); // no duplicate
      expect(list[0].name).to.equal("B"); // updated
    });

    it("adds createdAt on insert and updatedAt on update", () => {
      db.upsert("artefacts", { id: "1" });
      let item = db.get("artefacts")[0];

      expect(item.createdAt).to.exist;

      db.upsert("artefacts", { id: "1", value: 2 });
      item = db.get("artefacts")[0];

      expect(item.updatedAt).to.exist;
    });

  });
});
