/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: MIT
*/


/* c8 ignore next */
export function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* c8 ignore next */
export function getShortId(id) {
  return id.slice(0, 8);
}

export function getArtefactExt(output, format) {
  if (output === 'plantuml' && format === 'svg')  return 'svg';
  if (output === 'plantuml' && format === 'text') return 'puml';
  return 'json';
}

export function buildDocLabel({ scheme, value }) {
  const docMatch = value.match(/::([^#]+)##/);
  const docName  = docMatch ? docMatch[1].replace(/([A-Z])/g, ' $1').trim() : 'Document';

  if (value.endsWith('##*')) return `Any ${docName} (Wildcard)`;

  if (value.includes(':pint:')) {
    const regionMatch = value.match(/@([a-z0-9-]+)/i);
    const region      = regionMatch ? regionMatch[1].replace(/-1$/, '').toUpperCase() : 'PINT';
    const prefix      = scheme === 'peppol-doctype-wildcard' ? 'Wildcard' : 'PINT';
    return `${docName} (${prefix} ${region})`;
  }

  if (value.includes(':bis:') || value.includes('en16931')) {
    const bisMatch = value.match(/bis:[^:]+:(\d+)/);
    const version  = bisMatch ? bisMatch[1] : '3';
    return `${docName} (BIS ${version})`;
  }

  if (value.includes(':trns:')) {
    const trnsMatch = value.match(/:trns:([^:]+):([\d.]+)/);
    const version   = trnsMatch ? ` ${trnsMatch[2]}` : '';
    return `${docName} (TRNS${version})`;
  }

  return docName;
}

export function getParticipantValue(identifier) {
  return identifier?.includes('::') ? identifier.split('::')[1] : identifier;
}
