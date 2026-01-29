const { buildDocLabel } = require("../src/utils");
const { expect } = require("chai");

describe("utils", () => {
  describe("buildDocLabel()", () => {
    it("formats wildcard invoice", () => {
      const doc = {
          scheme: "peppol-doctype-wildcard",
          value: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##*"
      };

      expect(buildDocLabel(doc)).to.equal("Any Invoice (Wildcard)");
    });

    it("formats BIS invoice", () => {
      const doc = {
        scheme: "busdox-docid-qns",
        value: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017"
      };

      expect(buildDocLabel(doc)).to.equal("Invoice (BIS 3)");
    });

    it("falls back on 'unknown' value", () => {
      const doc = { scheme: "busdox-docid-qns", value: "unknown" };
      expect(buildDocLabel(doc)).to.equal("Document");
    });
  });
});