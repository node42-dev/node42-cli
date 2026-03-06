 /*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: MIT
*/

import fs   from 'fs';
import path from 'path';

import { fetchWithAuth }        from './identity/auth.js';
import { promptForDocument }    from './cli/prompt.js';
import { Spinner }              from './cli/spinner.js';
import { C, c }                 from './cli/color.js';
import { db }                   from './core/db.js';

import { 
  N42_HOME, 
  getUserDiscoveryDir 
}  from './cli/paths.js';

import { 
  getUserWithIndex, 
  setUserUsage 
} from './identity/user.js';

import { 
  N42Error, 
  N42ErrorCode, 
  handleApiError 
} from './core/error.js';

import { 
  buildDocLabel, 
  getShortId, 
  getArtefactExt 
} from './core/utils.js';

import { 
  API_URL, 
  DEFAULT_FORMAT, 
  DEFAULT_OUTPUT, 
  EP_DISCOVER 
} from './core/constants.js';

const DEFAULT_DISCOVERY_INPUT = {
  env: 'TEST',
  options: {
    forceHttps:        true,
    insecure:          false,
    fetchBusinessCard: false,
    reverseLookup:     false,
    probeEndpoints:    false
  },
  participant: {
    scheme: 'iso6523-actorid-upis',
    value:  '',
  },
  document: {
    scheme: 'peppol-doctype-wildcard',
    value:  '',
  },
  overrides: {
    smpUrl: '',
    apUrl:  '',
  },
  ai: {
    enabled:   false,
    mode:      'diagnostic',
    execution: 'sync'
  }
};

const spinner = new Spinner();

const discoveryInput = DEFAULT_DISCOVERY_INPUT;
let docSelected = false;

function wrapSvg(fileId, refId, svg) {
  const now      = new Date();
  const timeText = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const templateFile = path.join(N42_HOME, 'assets/discover.html.template');
  let html = fs.readFileSync(templateFile, 'utf8');

  html = html.replace('<!-- SVG -->',  svg);
  html = html.replace('<!-- TIME -->', `${timeText}  •  ${refId}`);
  html = html.replace('/--UUID--/',    fileId);

  const htmlFile = path.join(getUserDiscoveryDir(), `${fileId}.html`);
  fs.writeFileSync(htmlFile, html);
  return htmlFile;
}

async function processSupportedDocuments(encodedDocs, onDone) {
  if (encodedDocs && !docSelected) {
    const docs = JSON.parse(Buffer.from(encodedDocs, 'base64').toString('utf8'))
      .map(d => ({ ...d, label: buildDocLabel(d) }));

    if (docs.length) {
      console.log(`${C.BOLD}Found ${docs.length} supported document type(s)${C.RESET}\n`);

      docSelected = await promptForDocument(docs);

      if (docSelected.scheme) discoveryInput.document.scheme = docSelected.scheme;
      if (docSelected.value)  discoveryInput.document.value  = docSelected.value;

      if (typeof onDone === 'function') await onDone();
    }
  }
}

function aiToMarkdown(ai) {
  const evidenceTable = ai.evidence?.map(e =>
    `| ${e.field} | ${e.value || '*(empty)*'} | ${e.explanation} |`
  ).join('\n') || '';

  const references = ai.references?.map(r => `- ${r}`).join('\n') || '';

  return `## Node42 Discovery Analysis

_Request ID: **${ai.requestId}**_

**Version:** ${ai.version} 
**Engine:** ${ai.engine} 
**Runtime:** ${(ai.runtime / 1000).toFixed(2)} seconds  
**Status:** ${ai.status}  
**Confidence:** ${ai.confidence}  
**Layer:** ${ai.layer}  

## Root Cause
${ai.rootCause}

## Summary
${ai.summary}

## Impact
${ai.impact}

## Recommendation
${ai.recommendation}

## Evidence
| Field | Value | Explanation |
|------|------|-------------|
${evidenceTable}

## References
${references}

**Reference usage:**  
${ai.referenceUsage}
`;
}

export async function runDiscovery(participantId, options) {
  let {
    env,
    output = DEFAULT_OUTPUT,
    format = DEFAULT_FORMAT,
    forceHttps,
    insecure,
    fetchBusinessCard,
    reverseLookup,
    probeEndpoints,
    ai,
    aiExecution
  } = options;

  discoveryInput.participant.value = participantId;

  if (ai) {
    discoveryInput.ai.enabled = true;
    discoveryInput.ai.mode    = (ai === true) ? 'diagnostic' : ai;
    output = 'json';
  }

  if (aiExecution) {
    discoveryInput.ai.execution = (aiExecution === true) ? 'sync' : aiExecution;
  }

  const payload = {
    ...discoveryInput,
    env,
    options: { output, format, forceHttps, insecure, fetchBusinessCard, reverseLookup, probeEndpoints }
  };

  spinner.start(ai ? 'Running Discovery: with AI analysis (this may take a few seconds longer)...' : "Running Discovery");
 
  const url = `${API_URL}/${EP_DISCOVER}?output=${output}&format=${format}`;
  const res = await fetchWithAuth(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json();
    spinner.fail("Discovery Failed")

    if (err.code) {
      handleApiError(err);
    }
    process.exit(1);
  }

  const refId        = res.headers.get('X-Node42-RefId');
  const serviceUsage = res.headers.get('X-Node42-ServiceUsage');
  const rateLimit    = res.headers.get('X-Node42-RateLimit');
  const encodedDocs  = res.headers.get('X-Node42-Documents');
  const currentMonth = new Date().toISOString().slice(0, 7);

  const user = getUserWithIndex(0);
  setUserUsage(user.id, 'discovery', currentMonth, serviceUsage);

  const fileId   = getShortId(refId);
  const fileExt  = getArtefactExt(output, format);
  const fileName = `${fileId}.${fileExt}`;

  db.insert('discovery', {
    id: refId,
    participantId,
    options,
    file:      fileName,
    createdAt: Date.now()
  });

  if (output === 'plantuml' && format === 'svg') {
    const svg = await res.text();
    if (!svg || svg.trim().length === 0) {
      spinner.fail("Discovery Failed")
      throw new N42Error(N42ErrorCode.INVALID_OUTPUT, { details: "Server returned an empty SVG" });
    }

    spinner.done("Discovery completed");
    console.log();

    await processSupportedDocuments(encodedDocs, async () => runDiscovery(participantId, options));

    const file     = path.join(getUserDiscoveryDir(), fileName);
    fs.writeFileSync(file, svg);

    const htmlFile = wrapSvg(fileId, refId, svg);
    const link     = `\u001B]8;;file://${htmlFile}\u0007Open Diagram\u001B]8;;\u0007`;

    console.log(`${C.BOLD}Discovery Result${C.RESET}`);
    console.log(`PID      : ${participantId}`);
    console.log(`Artefact : ${fileName} ${c(C.BLUE, `[${link}]`)}`);
    console.log(`Usage    : ${c(C.RED, serviceUsage)} ${c(C.DIM, `(${rateLimit})`)}\n`);
    return;
  }

  if (output === 'plantuml' && format === 'text') {
    const text = await res.text();
    if (!text || text.trim().length === 0) {
      spinner.fail("Discovery Failed")
      throw new N42Error(N42ErrorCode.DISCOVERY_FAILED, { details: "Server returned an empty response" });
    }

    spinner.done("Discovery completed");
    console.log();

    await processSupportedDocuments(encodedDocs, async () => runDiscovery(participantId, options));

    const file = path.join(getUserDiscoveryDir(), fileName);
    fs.writeFileSync(file, text);

    const link = `\u001B]8;;file://${file}\u0007Open Diagram\u001B]8;;\u0007`;

    console.log(`${C.BOLD}Discovery Result${C.RESET}`);
    console.log(`PID      : ${participantId}`);
    console.log(`Artefact : ${fileName} ${c(C.BLUE, `[${link}]`)}`);
    console.log(`Usage    : ${c(C.RED, serviceUsage)} ${c(C.DIM, `(${rateLimit})`)}\n`);
    return;
  }

  // default: json
  const json = await res.json();
  if (!json || json.trim().length === 0) {
    spinner.fail("Discovery Failed")
    throw new N42Error(N42ErrorCode.DISCOVERY_FAILED, { details: "Server returned an empty response" });
  }

  spinner.done("Discovery completed");
  console.log();

  await processSupportedDocuments(encodedDocs, async () => runDiscovery(participantId, options));

  const file = path.join(getUserDiscoveryDir(), fileName);
  fs.writeFileSync(file, JSON.stringify(json, null, 2));

  const link = `\u001B]8;;file://${file}\u0007Open Diagram\u001B]8;;\u0007`;

  console.log(`${C.BOLD}Discovery Result${C.RESET}`)
  console.log(`PID      : ${participantId}`);
  console.log(`Artefact : ${fileName} ${c(C.BLUE, `[${link}]`)}`);
  console.log(`Usage    : ${c(C.RED, serviceUsage)} ${c(C.DIM, `(${rateLimit})`)}`);

  if (json.ai && json.ai.status === 'OK') {
    db.insert('discovery', {
      id: json.ai.requestId,
      participantId,
      options,
      file:      `${fileId}.md`,
      createdAt: Date.now()
    });

    const aiMarkdown = aiToMarkdown(json.ai);
    const mdFile     = path.join(getUserDiscoveryDir(), `${fileId}.md`);
    fs.writeFileSync(mdFile, aiMarkdown);

    const mdLink = `\u001B]8;;file://${mdFile}\u0007Open Analysis\u001B]8;;\u0007`;
    console.log(`Analysis : ${fileId}.md   ${c(C.BLUE, `[${mdLink}]`)}\n`);
  } else {
    console.log();
  }
}