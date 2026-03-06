 /*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: MIT
*/

import fs       from 'fs';
import path     from 'path';

import xpath    from 'xpath';
import { 
  DOMParser, 
  XMLSerializer 
} from 'xmldom';

import { fetchWithAuth }  from './identity/auth.js';
import { Spinner }        from './cli/spinner.js';
import { C }              from './cli/color.js';

import { 
  N42Error,
  N42ErrorCode,
  handleApiError
} from './core/error.js';

import { 
  N42_HOME, 
  getUserValidationsDir 
} from './cli/paths.js';
import { EP_VALIDATE, VALIDATOR_URL } from './core/constants.js';


const infoAssertions = [
  {
    identifier: 'INFO-SENDER',
    flag:       'INFO1',
    location:   '/sbdh:StandardBusinessDocumentHeader/sbdh:Sender/sbdh:Identifier',
    text:       'Sender participant identifier'
  },
  {
    identifier: 'INFO-RECEIVER',
    flag:       'INFO2',
    location:   '/sbdh:StandardBusinessDocumentHeader/sbdh:Receiver/sbdh:Identifier',
    text:       'Receiver participant identifier'
  },
  {
    identifier: 'INFO-DOC-STANDARD',
    flag:       'INFO1',
    location:   '/sbdh:StandardBusinessDocumentHeader/sbdh:DocumentIdentification/sbdh:Standard',
    text:       'UBL document standard'
  },
  {
    identifier: 'INFO-DOC-ID',
    flag:       'INFO2',
    location:   '/sbdh:StandardBusinessDocumentHeader/sbdh:DocumentIdentification/sbdh:InstanceIdentifier',
    text:       'UBL document identifier'
  },
  {
    identifier: 'INFO-DOC-CREATION-DATE',
    flag:       'INFO1',
    location:   '/sbdh:StandardBusinessDocumentHeader/sbdh:DocumentIdentification/sbdh:CreationDateAndTime',
    text:       'UBL document creation date'
  },
  {
    identifier: 'INFO-DOCUMENTID',
    flag:       'INFO0',
    location:   '/sbdh:StandardBusinessDocumentHeader/sbdh:BusinessScope/sbdh:Scope[sbdh:Type=\'DOCUMENTID\']/sbdh:InstanceIdentifier',
    text:       'Document Identifier (Peppol Document ID)'
  },
  {
    identifier: 'INFO-PROCESSID',
    flag:       'INFO0',
    location:   '/sbdh:StandardBusinessDocumentHeader/sbdh:BusinessScope/sbdh:Scope[sbdh:Type=\'PROCESSID\']/sbdh:InstanceIdentifier',
    text:       'Peppol Business Process Identifier'
  },
  {
    identifier: 'INFO-COUNTRY',
    flag:       'INFO0',
    location:   '/sbdh:StandardBusinessDocumentHeader/sbdh:BusinessScope/sbdh:Scope[sbdh:Type=\'COUNTRY_C1\']/sbdh:InstanceIdentifier',
    text:       'Country code used for routing (C1)'
  }
];

const spinner = new Spinner();

function wrapXml(docName, refId, xml) {
  const now      = new Date();
  const timeText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const templateFile = path.join(N42_HOME, 'assets/validator.html.template');
  let html = fs.readFileSync(templateFile, 'utf8');

  html = html.replace('<!-- XML -->',  xml);
  html = html.replace('<!-- TIME -->', `${timeText}  •  ${docName}`);
  html = html.replace('/--UUID--/',    refId);

  const htmlFile = path.join(getUserValidationsDir(), 'validation.html');
  fs.writeFileSync(htmlFile, html);
  return htmlFile;
}

function parseXml(xmlString) {
  const parser = new DOMParser();
  const doc    = parser.parseFromString(xmlString, 'application/xml');

  const errors = doc.getElementsByTagName('parsererror');
  if (errors.length > 0) {
    throw new N42Error(N42ErrorCode.INVALID_INPUT, { details: "Invalid XML" });
  }
  return doc;
}

function normalizeLocation(loc) {
  if (loc.includes('local-name()')) return loc;

  const parts = loc.split('/').filter(Boolean);
  if (!parts.length) return '';

  return parts.reduce((xp, part, i) => {
    const base     = part.split('[')[0];
    const baseName = base.includes(':') ? base.split(':')[1] : base;
    const preds    = [...part.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);

    let cond = `local-name()='${baseName}'`;
    let pos  = '';

    for (const p of preds) {
      if (/^\d+$/.test(p)) {
        pos = `[${p}]`;
        continue;
      }
      const m = p.match(/^[A-Za-z0-9_-]+:([A-Za-z0-9_-]+)\s*=\s*'([^']*)'$/);
      if (m) {
        const [, childName, value] = m;
        cond += ` and *[local-name()='${childName}']='${value}'`;
      }
    }

    const step = `*[${cond}]${pos}`;
    return xp + (i === 0 ? `//${step}` : `/${step}`);
  }, '');
}

function serializeHighlightedXml(doc) {
  const serializer = new XMLSerializer();
  let xml = serializer.serializeToString(doc);

  xml = xml
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;');

  xml = xml.replace(
    /(&lt;[^&\n>]*data-highlight="true"[^&\n>]*&gt;[\s\S]*?&lt;\/[^&\n>]+&gt;)/g,
    m => {
      const level   = /data-level="(INFO0|INFO1|INFO2|ERROR|WARNING)"/.exec(m)?.[1] || 'WARNING';
      const msg     = /data-msg="([^"]+)"/.exec(m)?.[1] || '';
      const cleaned = m
        .replace(/\sdata-highlight="true"/g, '')
        .replace(/\sdata-level="[^"]*"/g,    '')
        .replace(/\sdata-msg="[^"]*"/g,      '');
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
      n.setAttribute('data-highlight', 'true');
      n.setAttribute('data-level',     a.flag);
      n.setAttribute('data-msg',       a.text);
    }
  });

  return serializeHighlightedXml(doc);
}

function highlightAssertions(docName, validationReport, xml) {
  const assertions = [
    ...infoAssertions,
    ...(validationReport?.sections?.flatMap(s => s.assertions || []) ?? [])
  ];

  const refId        = crypto.randomUUID();
  const formattedXml = highlightByAssertions(xml, assertions);
  return wrapXml(docName, refId, formattedXml);
}

function handleValidationReport(artefactFile, report) {
  const seen = new Set();

  const counts = (report?.sections ?? [])
    .flatMap(s => (s.assertions ?? []).map(a => ({ ...a, configuration: s.configuration })))
    .filter(a => {
      const key = `${a.configuration}:${a.identifier}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .reduce((acc, a) => {
      if (a.flag === 'ERROR')   acc.error++;
      else if (a.flag === 'WARNING') acc.warning++;
      return acc;
    }, { error: 0, warning: 0 });

  const title = `${C.BOLD}Validation Result${C.RESET}\n\n`;
  let message = '';
  let color   = `${C.BOLD}`;
  let tip;

  if (counts.error && counts.warning) {
    message = `The validator found ${counts.error} error(s) and ${counts.warning} warnings.`;
    color   = `${C.RED}`;
    tip     = `Review and correct the assertions highlighted,\nthen revalidate before sending.`;
  } else if (counts.error) {
    message = `The validator found ${counts.error} error(s).`;
    color   = `${C.RED}`;
    tip     = `Review and correct the assertions highlighted,\nthen revalidate before sending.`;
  } else if (counts.warning) {
    message = `The validator found ${counts.warning} warning(s).`;
    color   = `${C.YELLOW}`;
    tip     = `Review and correct the assertions highlighted,\nthen revalidate before sending.`;
  } else {
    message = 'The validation completed without any assertions.';
    tip     = 'The document has passed validation and is ready to be sent.';
  }

  const link = `\u001B]8;;file://${artefactFile}\u0007View Report\u001B]8;;\u0007`;
  console.log(`${title}${color}${message}${C.RESET} ${C.BLUE}[${link}]${C.RESET}\n\n${tip}\n`);
}

export async function runValidation(docName, xmlDoc, options) {
  const { ruleset, location, runtime } = options;

  spinner.start("Validating Document");

  const url = new URL(`${VALIDATOR_URL}/${EP_VALIDATE}`);
  url.search = new URLSearchParams({
    ruleset,
    ...(location && { location: 'true' }),
    ...(runtime  && { runtime:  'true' }),
  }).toString();

  const res = await fetchWithAuth(url.toString(), {
    method:  'POST',
    headers: { 'Content-Type': 'application/xml' },
    body:    xmlDoc
  });

  if (!res.ok) {
    const err = await res.json();
    spinner.start("Validation Failed");

    if (err.code) {
      handleApiError(err);
    }
    process.exit(1);
  }

  const validationReport = await res.json();
  spinner.start("Document Validated");

  const artefactFile = highlightAssertions(docName, validationReport, xmlDoc);
  handleValidationReport(artefactFile, validationReport);
}