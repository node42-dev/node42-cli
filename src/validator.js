const fs = require("fs");
const path = require("path");
const { DOMParser, XMLSerializer } = require("xmldom");
const xpath = require("xpath");
const { NODE42_DIR, VALIDATOR_URL, EP_VALIDATE, VALIDATIONS_DIR } = require("./config");
const { startSpinner } = require("./utils");
const { fetchWithAuth } = require("./auth");
const { handleError } = require("./errors");
const C = require("./colors");

const infoAssertions = [
   {
    identifier: "INFO-SENDER",
    flag: "INFO1",
    location: "/sbdh:StandardBusinessDocumentHeader/sbdh:Sender/sbdh:Identifier",
    text: "Sender participant identifier"
  },
  {
    identifier: "INFO-RECEIVER",
    flag: "INFO2",
    location: "/sbdh:StandardBusinessDocumentHeader/sbdh:Receiver/sbdh:Identifier",
    text: "Receiver participant identifier"
  },
  {
    identifier: "INFO-DOC-STANDARD",
    flag: "INFO1",
    location: "/sbdh:StandardBusinessDocumentHeader/sbdh:DocumentIdentification/sbdh:Standard",
    text: "UBL document standard"
  },
  {
    identifier: "INFO-DOC-ID",
    flag: "INFO2",
    location: "/sbdh:StandardBusinessDocumentHeader/sbdh:DocumentIdentification/sbdh:InstanceIdentifier",
    text: "UBL document identifier"
  },
  {
    identifier: "INFO-DOC-CREATION-DATE",
    flag: "INFO1",
    location: "/sbdh:StandardBusinessDocumentHeader/sbdh:DocumentIdentification/sbdh:CreationDateAndTime",
    text: "UBL document creation date"
  },
  {
    identifier: "INFO-DOCUMENTID",
    flag: "INFO0",
    location: "/sbdh:StandardBusinessDocumentHeader/sbdh:BusinessScope/sbdh:Scope[sbdh:Type='DOCUMENTID']/sbdh:InstanceIdentifier",
    text: "Document Identifier (Peppol Document ID)"
  },
  {
    identifier: "INFO-PROCESSID",
    flag: "INFO0",
    location: "/sbdh:StandardBusinessDocumentHeader/sbdh:BusinessScope/sbdh:Scope[sbdh:Type='PROCESSID']/sbdh:InstanceIdentifier",
    text: "Peppol Business Process Identifier"
  },
  {
    identifier: "INFO-COUNTRY",
    flag: "INFO0",
    location: "/sbdh:StandardBusinessDocumentHeader/sbdh:BusinessScope/sbdh:Scope[sbdh:Type='COUNTRY_C1']/sbdh:InstanceIdentifier",
    text: "Country code used for routing (C1)"
  }
];

function wrapXml(docName, refId, xml) {
  let html;

  const now = new Date();
  const timeText = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

  const templateFile = path.join(NODE42_DIR, "assets/validator.html.template");
  const template = fs.readFileSync(templateFile, "utf8");
  
  html = template.replace("<!-- XML -->", xml);
  html = html.replace("<!-- TIME -->", `${timeText}  •  ${docName}`);
  html = html.replace("/--UUID--/", refId);
  
  const htmlFile = path.join(VALIDATIONS_DIR, `validation.html`);
  fs.writeFileSync(htmlFile, html);
  return htmlFile;
}

function parseXml(xmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");

  const errors = doc.getElementsByTagName("parsererror");
  if (errors.length > 0) {
    throw new Error("Invalid XML");
  }
  return doc;
}

function normalizeLocation(path) {
  // already normalized → do NOTHING
  if (path.includes("local-name()")) {
    return path;
  }

  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return "";

  return parts.reduce((xp, part, i) => {
    // split "Name[predicate]" into base + predicateText
    const base = part.split("[")[0];                 // e.g. "Scope" or "ubl:Invoice"
    const baseName = base.includes(":") ? base.split(":")[1] : base;

    // collect predicates: [1] and [x:Type='DOCUMENTID']
    const preds = [...part.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);

    let cond = `local-name()='${baseName}'`;
    let pos = "";

    for (const p of preds) {
      // positional: [1]
      if (/^\d+$/.test(p)) {
        pos = `[${p}]`;
        continue;
      }
      // typed predicate: [sbdh:Type='DOCUMENTID']
      const m = p.match(/^[A-Za-z0-9_-]+:([A-Za-z0-9_-]+)\s*=\s*'([^']*)'$/);
      if (m) {
        const [, childName, value] = m;
        cond += ` and *[local-name()='${childName}']='${value}'`;
      }
    }

    const step = `*[${cond}]${pos}`;
    return xp + (i === 0 ? `//${step}` : `/${step}`);
  }, "");
}

function serializeHighlightedXml(doc) {
  const serializer = new XMLSerializer();
  let xml = serializer.serializeToString(doc);

  xml = xml
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  xml = xml.replace(
    /(&lt;[^&\n>]*data-highlight="true"[^&\n>]*&gt;[\s\S]*?&lt;\/[^&\n>]+&gt;)/g,
    m => {
      const level = /data-level="(INFO0|INFO1|INFO2|ERROR|WARNING)"/.exec(m)?.[1] || "WARNING";
      const msg = /data-msg="([^"]+)"/.exec(m)?.[1] || "";

      // REMOVE helper attributes from output
      const cleaned = m
      .replace(/\sdata-highlight="true"/g, "")
      .replace(/\sdata-level="[^"]*"/g, "")
      .replace(/\sdata-msg="[^"]*"/g, "");
      
      return `<span class="xml-${level.toLowerCase()}" title="${msg}">${cleaned}</span>`;
    }
  );

  return xml;
}

function highlightByAssertions(xmlString, assertions) {
  const doc = parseXml(xmlString);

  assertions.forEach(a => {
    const xp = normalizeLocation(a.location);
    if (!xp) return;

    const nodes = xpath.select(xp, doc);

    for (const n of nodes) {
      n.setAttribute("data-highlight", "true");
      n.setAttribute("data-level", a.flag); // ERROR | WARNING
      n.setAttribute("data-msg", a.text);   // validator message
    }
  });

  return serializeHighlightedXml(doc);
}

function highligtAssertions(docName, validationReport, xml) {
   const assertions = [
    ...infoAssertions,
    ...(validationReport?.sections?.flatMap(s => s.assertions || []) ?? [])
  ];
  //console.log(assertions);

  const refId = crypto.randomUUID();

  const formattedXml = highlightByAssertions(xml, assertions);
  return wrapXml(docName, refId, formattedXml)
}

function handleValidationReport(artefactFile, report) {
  const seen = new Set();

  const counts = (report?.sections ?? [])
    .flatMap(s =>
      (s.assertions ?? []).map(a => ({
        ...a,
        configuration: s.configuration
      }))
    )
    .filter(a => {
      const key = `${a.configuration}:${a.identifier}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .reduce((acc, a) => {
      if (a.flag === "ERROR") acc.error++;
      else if (a.flag === "WARNING") acc.warning++;
      return acc;
    }, { error: 0, warning: 0 });

  let title = `${C.BOLD}Validation Result${C.RESET}\n\n`;
  let message = "";
  let color = `${C.BOLD}`;
  let tip;

  if (counts.error !== 0 && counts.warning !== 0) {
    message += `The validator found ${counts.error} error(s) and ${counts.warning} warnings.`;
    color =  `${C.RED}`;
    tip = `Review and correct the assertions highlighted,\nthen revalidate before sending.`
  }
  else if (counts.error !== 0) {
    message += `The validator found ${counts.error} error(s).`;
    color =  `${C.RED}`;
    tip = `Review and correct the assertions highlighted,\nthen revalidate before sending.`
  }
  else if (counts.warning !== 0) {
    message += `The validator found ${counts.warning} warning(s).`;
    color =  `${C.YELLOW}`;
    tip = `Review and correct the assertions highlighted,\nthen revalidate before sending.`
  }
  else {
    message += "The validation completed without any assertions.";
    tip = "The document has passed validation and is ready to be sent."
  }

  const link = `\u001B]8;;file://${artefactFile}\u0007View Report\u001B]8;;\u0007`;
  console.log(`${title}${color}${message}${C.RESET} ${C.BLUE}[${link}]${C.RESET}\n\n${tip}\n`);
}

async function runValidation(docName, xmlDoc, options) {
  const {
    ruleset,
    location,
    runtime,
  } = options;
 
  const stopSpinner = startSpinner();

  const url = new URL(`${VALIDATOR_URL}/${EP_VALIDATE}`);
  url.search = new URLSearchParams({
    ruleset,
    ...(location && { location: "true" }),
    ...(runtime && { runtime: "true" }),
  }).toString();

  const res = await fetchWithAuth(url.toString(), {
      method: "POST",
      headers: {
          "Content-Type": "application/xml"
      },
      body: xmlDoc
  });

  if (!res.ok) {
    const err = await res.json();
    stopSpinner();

    if (err.code) {
      await handleError(err);
    }

    process.exit(1);
  }

  const validationReport = await res.json();
  stopSpinner();

  const artefactFile = highligtAssertions(docName, validationReport, xmlDoc);
  handleValidationReport(artefactFile, validationReport);
}

module.exports = { runValidation };