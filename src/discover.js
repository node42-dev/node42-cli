const fs = require("fs");
const path = require("path");
const db = require("./db");
const C = require("./colors");

const { fetchWithAuth } = require("./auth");
const { API_URL, EP_DISCOVER, DEFAULT_OUTPUT, DEFAULT_FORMAT, NODE42_DIR, ARTEFACTS_DIR } = require("./config");
const { getUserWithIndex, setUserUsage } = require("./user");
const { startSpinner, buildDocLabel, promptForDocument, getShortId, getArtefactExt } = require("./utils");
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

function wrapSvg(fileId, refId, svg) {
  let html;

  const now = new Date();
  const timeText = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  const templateFile = path.join(NODE42_DIR, "assets/discover.html.template");
  const template = fs.readFileSync(templateFile, "utf8");
  
  html = template.replace("<!-- SVG -->", svg);
  html = html.replace("<!-- TIME -->", `${timeText}  •  ${refId}`);
  html = html.replace("/--UUID--/", fileId);
  
  const htmlFile = path.join(ARTEFACTS_DIR, `${fileId}.html`);
  fs.writeFileSync(htmlFile, html);
  return htmlFile;
}

async function processSupportedDocuments(encodedDocs, onDone) {
  if (encodedDocs && !docSelected) {
      const docs = JSON.parse(Buffer.from(encodedDocs, "base64").toString("utf8"))
      .map(d => ({ ...d, label: buildDocLabel(d) }));

    if (docs.length) {
      console.log(`${C.BOLD}Found ${docs.length} supported document type(s)${C.RESET}\n`);
      
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
 
  const user = getUserWithIndex(0);
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

    const htmlFile = wrapSvg(fileId, refId, svg);
    const link = `\u001B]8;;file://${htmlFile}\u0007Open Diagram\u001B]8;;\u0007`;

    console.log(`${C.BOLD}Discovery completed${C.RESET}`);
    console.log(`PID      : ${participantId}`);
    console.log(`Artefact : ${fileName} ${C.BLUE}[${link}]${C.RESET}`);
    console.log(`Usage    : ${C.RED}${serviceUsage}${C.RESET} ${C.DIM}(${rateLimit})${C.RESET}\n`);
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

    const link = `\u001B]8;;file://${file}\u0007Open Diagram\u001B]8;;\u0007`;

    console.log(`${C.BOLD}Discovery completed${C.RESET}`);
    console.log(`PID      : ${participantId}`);
    console.log(`Artefact : ${fileName} ${C.BLUE}[${link}]${C.RESET}`);
    console.log(`Usage    : ${C.RED}${serviceUsage}${C.RESET} ${C.DIM}(${rateLimit})${C.RESET}\n`);
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

  const link = `\u001B]8;;file://${file}\u0007Open Diagram\u001B]8;;\u0007`;

  console.log(`${C.BOLD}Discovery completed${C.RESET}`);
  console.log(`PID      : ${participantId}`);
  console.log(`Artefact : ${fileName} ${C.BLUE}[${link}]${C.RESET}`);
  console.log(`Usage    : ${C.RED}${serviceUsage}${C.RESET} ${C.DIM}(${rateLimit})${C.RESET}\n`); 
}

module.exports = { runDiscovery };