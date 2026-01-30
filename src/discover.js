const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");
const db = require("./db");

const { fetchWithAuth } = require("./auth");
const { API_URL, EP_DISCOVER, DEFAULT_OUTPUT, DEFAULT_FORMAT, ARTEFACTS_DIR } = require("./config");
const { getUser, setUserUsage } = require("./user");
const { clearScreen, startSpinner, buildDocLabel, promptForDocument, getShortId, getArtefactExt } = require("./utils");
const { handleError } = require("./errors"); 

const DEFAULT_DISCOVERY_INPUT = {
  env: "TEST",
  options: {
    forceHttps: true,
    insecure: false,
    fetchBusinessCard: false,
    reverseLookup: false,
    probeEndpoints: false
  },
  participant: {
    scheme: "iso6523-actorid-upis",
    value: "",
  },
  document: {
    scheme: "peppol-doctype-wildcard",
    value: "",
  },
  overrides: {
    smpUrl: "",
    apUrl: "",
  }
};
const discoveryInput = DEFAULT_DISCOVERY_INPUT;
let docSelected = false;

async function processSupportedDocuments(encodedDocs, onDone) {
  if (encodedDocs && !docSelected) {
      const docs = JSON.parse(Buffer.from(encodedDocs, "base64").toString("utf8"))
      .map(d => ({ ...d, label: buildDocLabel(d) }));

    if (docs.length) {
      console.log(`Discovery completed`);
      console.log(`Found ${docs.length} supported document type(s)\n`);
      
      docSelected = await promptForDocument(docs);

      if (docSelected.scheme) {
        discoveryInput.document.scheme = docSelected.scheme;
      }

      if (docSelected.value) {
        discoveryInput.document.value = docSelected.value;
      }

      if (typeof onDone === "function") {
        await onDone(); // no args
      }
    }
  }
}

async function runDiscovery(participantId, options) {
  const {
    env,
    output = DEFAULT_OUTPUT,
    format = DEFAULT_FORMAT,
    forceHttps,
    insecure,
    fetchBusinessCard,
    reverseLookup,
    probeEndpoints
  } = options;

  discoveryInput.participant.value = participantId;

  const payload = {
    ...discoveryInput,
    env,
    options: {
      output,
      format,
      forceHttps,
      insecure,
      fetchBusinessCard,
      reverseLookup,
      probeEndpoints
    }
  };

  clearScreen(`Node42 CLI v${pkg.version}`);
  const stopSpinner = startSpinner();

  const url = `${API_URL}/${EP_DISCOVER}?output=${output}&format=${format}`;
  const res = await fetchWithAuth(url, {
      method: "POST",
      headers: {
          "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json();
    stopSpinner();

    if (err.code) {
      await handleError(err);
    }

    process.exit(1);
  }

  const refId = res.headers.get("X-Node42-RefId");  
  const serviceUsage = res.headers.get("X-Node42-ServiceUsage");
  const rateLimit = res.headers.get("X-Node42-RateLimit");
  const encodedDocs = res.headers.get("X-Node42-Documents");
  const currentMonth = new Date().toISOString().slice(0, 7);
 
  const user = getUser();
  setUserUsage(
    user.id,
    "discovery",
    currentMonth,
    serviceUsage
  );

  const fileId = getShortId(refId);
  const fileExt = getArtefactExt(output, format);
  const fileName = `${fileId}.${fileExt}`;

  db.insert("artefacts", {
    id: refId,
    participantId,
    options,
    file: fileName, 
    createdAt: Date.now()
  });
 
  if (output === "plantuml" && format === "svg") {
    const svg = await res.text();
    stopSpinner();

    if (!svg || svg.trim().length === 0) {
      await handleError({ code: "6123" });
      process.exit(1);
    }

    await processSupportedDocuments(encodedDocs, async () => {
      await runDiscovery(participantId, options);
    });

    const file = path.join(ARTEFACTS_DIR, `${fileName}`);
    fs.writeFileSync(file, svg);

    console.log(`Discovery completed`);
    console.log(`Usage    : ${serviceUsage} / ${rateLimit}`);
    console.log(`Artefact : ${file}\n`);
    return;
  }

  if (output === "plantuml" && format === "text") {
    const text = await res.text();
    stopSpinner();

    await processSupportedDocuments(encodedDocs, async () => {
      await runDiscovery(participantId, options);
    });

    const file = path.join(ARTEFACTS_DIR, `${fileName}`);
    fs.writeFileSync(file, text);

    console.log(`Discovery completed`);
    console.log(`Usage    : ${serviceUsage} / ${rateLimit}`);
    console.log(`Artefact : ${file}\n`);
    return;
  }

  // default: json
  const json = await res.json();
  stopSpinner();

  await processSupportedDocuments(encodedDocs, async () => {
    await runDiscovery(participantId, options);
  });

  const file = path.join(ARTEFACTS_DIR, `${fileName}`);
  fs.writeFileSync(file, JSON.stringify(json, null, 2));

  console.log(`Discovery completed`);
  console.log(`Usage    : ${serviceUsage} / ${rateLimit}`);
  console.log(`Artefact : ${file}\n`);
}

module.exports = { runDiscovery };