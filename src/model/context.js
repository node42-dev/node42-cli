/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: AGPL-3.0-only
*/

import { randomUUID } from 'crypto';

export class N42Context {
  constructor(opts = {}) {
    this.command          = opts.command          ?? null;
    this.subcommand       = opts.subcommand       ?? null;
    
    this.env              = opts.env              ?? 'test';
    this.runtimeEnv       = opts.runtimeEnv       ?? null;
    
    this.docXml           = opts.docXml           ?? null;
    this.docName          = opts.docName          ?? null;
    
    this.id               = opts.id               ?? randomUUID();
    this.userId           = opts.userId           ?? null;
    this.timestamp        = opts.timestamp        ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
   
    this.participantId    = opts.participantId    ?? null;
    this.options          = opts.options          ?? null;

    this.persist          = opts.persist          ?? false;
    this.verbose          = opts.verbose          ?? false;
    this.timeout          = opts.timeout          ?? 20000;
    
    this.spinner          = opts.spinner          ?? null;
    this.saxonAvailable   = opts.saxonAvailable   ?? false;
  }
}