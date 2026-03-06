/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: MIT
*/

import fs   from 'fs';
import path from 'path';
import os   from 'os';

import { DEFAULT_FORMAT, DEFAULT_OUTPUT } from '../core/constants.js';

import { db }   from '../core/db.js';
import { C } from './color.js';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(import.meta.url.startsWith('file:') 
  ? fileURLToPath(import.meta.url) 
  : import.meta.url);

export const N42_HOME = path.join(os.homedir(), '.node42');


function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function destExists(p) {
  return fs.existsSync(p) ? p : null;
}

export function getAssetsDir() {
  return path.resolve(__dirname, '../assets');
}

export function getUserHomeDir()         { return ensureDir(N42_HOME); }
export function getUserCertsDir()        { return ensureDir(path.join(N42_HOME, 'certs')); }
export function getUserSchematronDir()   { return ensureDir(path.join(N42_HOME, 'schematrons')); }
export function getUserTemplatesDir()    { return ensureDir(path.join(N42_HOME, 'templates')); }
export function getUserReportsDir()      { return ensureDir(path.join(N42_HOME, 'reports')); }

export function getUserArtefactsDir()    { return ensureDir(path.join(N42_HOME, 'artefacts')); }
export function getUserDiscoveryDir()    { return ensureDir(path.join(N42_HOME, 'artefacts', 'discovery')); }
export function getUserTransactionsDir() { return ensureDir(path.join(N42_HOME, 'artefacts', 'transactions')); }
export function getUserValidationsDir()  { return ensureDir(path.join(N42_HOME, 'artefacts', 'validations')); }

export function getDbFile()              { return path.join(N42_HOME, 'db.json'); }
export function getTokensFile()          { return path.join(N42_HOME, 'tokens.json'); }
export function getConfigFile()          { return path.join(N42_HOME, 'config.json'); }


export function initConfig(force = false) {
  const configFile = getConfigFile();
  if (!fs.existsSync(configFile) || force) {
    fs.writeFileSync(
      configFile,
      JSON.stringify({ DEFAULT_OUTPUT, DEFAULT_FORMAT }, null, 2)
    );
  }
}

export function initAssets() {
  const src  = path.join(__dirname, 'assets');
  const dest = path.join(N42_HOME, 'assets');
  fs.cpSync(src, dest, { recursive: true });

}

export function initWorkspace(force = false) {
  getUserHomeDir();
   getUserArtefactsDir();
   getUserDiscoveryDir();
   getUserTransactionsDir();
   getUserValidationsDir();

   initAssets();
   initConfig(force);
}

export function cleanAppDirs(options) {
  const { tokens, artefacts, discoveries, transactions, validations, db: dbFlag, all } = options;

  if (Object.keys(options).length === 0) {
    console.log(`${C.RED}Nothing to clean${C.RESET}`);
    return;
  }

  const removed = [];

  const tokensFile = getTokensFile();
  if ((all || tokens) && fs.existsSync(tokensFile)) {
    fs.unlinkSync(tokensFile);
    removed.push('tokens');
  }

  const databaseFile = getDbFile();
  if ((all || dbFlag) && fs.existsSync(databaseFile)) {
    fs.unlinkSync(databaseFile);
    removed.push('database');
  }

   const discoveryDir = getUserDiscoveryDir();
  if (all || discoveries) {
    try { db.clear('discovery'); } catch { /* ignore */ }
    if (fs.existsSync(discoveryDir)) {
      fs.rmSync(discoveryDir, { recursive: true, force: true });
      fs.mkdirSync(discoveryDir, { recursive: true });
    }
    removed.push('discovery');
  }

  const transactionsDir = getUserTransactionsDir();
  if (all || transactions) {
    try { db.clear('transactions'); } catch { /* ignore */ }
    if (fs.existsSync(transactionsDir)) {
      fs.rmSync(transactionsDir, { recursive: true, force: true });
      fs.mkdirSync(transactionsDir, { recursive: true });
    }
    removed.push('transactions');
  }

  const validationsDir = getUserValidationsDir();
  if (all || validations) {
    try { db.clear('validations'); } catch { /* ignore */ }
    if (fs.existsSync(validationsDir)) {
      fs.rmSync(validationsDir, { recursive: true, force: true });
      fs.mkdirSync(validationsDir, { recursive: true });
    }
    removed.push('validations');
  }

  const artefactsDir = getUserArtefactsDir();
  if (all || artefacts) {
    try { 
      db.clear('discovery');
      db.clear('transactions');
      db.clear('validations'); 
    } catch { /* ignore */ }
    if (fs.existsSync(artefactsDir)) {
      fs.rmSync(artefactsDir, { recursive: true, force: true });
      fs.mkdirSync(artefactsDir, { recursive: true });
    }
    removed.push('artefacts');
  }

  if (removed.length === 0) {
    console.log(`${C.RED}Nothing removed${C.RESET}`);
  } else {
    console.log(`${C.BOLD}Removed ${removed.length} item(s)${C.RESET}`);
    for (const r of removed) console.log(` ${C.RED}• ${r}${C.RESET}`);
    console.log();
  }
}