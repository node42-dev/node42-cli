/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: AGPL-3.0-only
*/

import fs   from 'fs';
import path from 'path';
import os   from 'os';

import { DEFAULT_FORMAT, DEFAULT_OUTPUT } from '../core/constants.js';
import { c, C } from './color.js';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(import.meta.url.startsWith('file:') 
  ? fileURLToPath(import.meta.url) 
  : import.meta.url);

import { 
  createDb, 
  getDbAdapter 
} from '../db/db.js';

export const getN42Home = () => path.join(os.homedir(), '.node42');

let db = null;
async function getDb() {
  if (!db) db = createDb(await getDbAdapter());
  return db;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function destExists(p) {
  return fs.existsSync(p) ? p : null;
}

export function getAssetsDir() {
  return path.resolve(__dirname, 'assets');
}

export function getUserHomeDir()         { return ensureDir(getN42Home()); }
export function getUserCertsDir()        { return ensureDir(path.join(getN42Home(), 'certs')); }
export function getUserSchematronDir()   { return ensureDir(path.join(getN42Home(), 'schematrons')); }
export function getUserTemplatesDir()    { return ensureDir(path.join(getN42Home(), 'templates')); }
export function getUserReportsDir()      { return ensureDir(path.join(getN42Home(), 'reports')); }

export function getUserArtefactsDir()    { return ensureDir(path.join(getN42Home(), 'artefacts')); }
export function getUserDiscoveryDir()    { return ensureDir(path.join(getN42Home(), 'artefacts', 'discovery')); }
export function getUserTransactionsDir() { return ensureDir(path.join(getN42Home(), 'artefacts', 'transactions')); }
export function getUserValidationsDir()  { return ensureDir(path.join(getN42Home(), 'artefacts', 'validations')); }

export function getDbFile()              { return path.join(getN42Home(), 'db.json'); }
export function getTokensFile()          { return path.join(getN42Home(), 'tokens.json'); }
export function getConfigFile()          { return path.join(getN42Home(), 'config.json'); }


export function initWorkspace(force = false) {
   getUserHomeDir();
   getUserArtefactsDir();
   getUserDiscoveryDir();
   getUserTransactionsDir();
   getUserValidationsDir();

   initUiAssets();
   initDotEnv(force);
   initConfig(force);
}

export function initShellCompletion() {
  const src = path.join(__dirname, 'completion/bash.sh');
  const dest = path.join(getUserHomeDir(), 'completion.bash');
  fs.copyFileSync(src, dest);

  console.log(`Completion script saved to ${dest}`);
  console.log(`Run: ${c(C.BOLD, 'source ' + dest)}\n`);
}

export function initDotEnv(force=false) {
  const src = path.join(getAssetsDir(), 'env.example');
  const dest = path.join(getUserHomeDir(), '.env.test');
  if (force || !fs.existsSync(dest)) {
    fs.copyFileSync(src, dest);
  }
}

export function initConfig(force = false) {
  const configFile = getConfigFile();
  if (!fs.existsSync(configFile) || force) {
    fs.writeFileSync(
      configFile,
      JSON.stringify({ DEFAULT_OUTPUT, DEFAULT_FORMAT }, null, 2)
    );
  }
}

export function initUiAssets() {
  const src  = path.join(getAssetsDir(), 'ui');
  const dest = path.join(getN42Home(), 'assets');
  fs.cpSync(src, dest, { recursive: true });

}

export async function cleanAppDirs(options) {
  db = await getDb();

  const { tokens, artefacts, discoveries, transactions, validations, db: dbFlag, all } = options;

  if (Object.keys(options).length === 0) {
    console.log(`${c(C.RED, 'Nothing to clean')}`);
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
    try { db.clear('Discovery'); } catch { /* ignore */ }
    if (fs.existsSync(discoveryDir)) {
      fs.rmSync(discoveryDir, { recursive: true, force: true });
      fs.mkdirSync(discoveryDir, { recursive: true });
    }
    removed.push('discovery');
  }

  const transactionsDir = getUserTransactionsDir();
  if (all || transactions) {
    try { db.clear('Transactions'); } catch { /* ignore */ }
    if (fs.existsSync(transactionsDir)) {
      fs.rmSync(transactionsDir, { recursive: true, force: true });
      fs.mkdirSync(transactionsDir, { recursive: true });
    }
    removed.push('transactions');
  }

  const validationsDir = getUserValidationsDir();
  if (all || validations) {
    try { db.clear('Validations'); } catch { /* ignore */ }
    if (fs.existsSync(validationsDir)) {
      fs.rmSync(validationsDir, { recursive: true, force: true });
      fs.mkdirSync(validationsDir, { recursive: true });
    }
    removed.push('validations');
  }

  const artefactsDir = getUserArtefactsDir();
  if (all || artefacts) {
    try { 
      db.clear('Discovery');
      db.clear('Transactions');
      db.clear('Validations'); 
    } catch { /* ignore */ }
    if (fs.existsSync(artefactsDir)) {
      fs.rmSync(artefactsDir, { recursive: true, force: true });
      fs.mkdirSync(artefactsDir, { recursive: true });
    }
    removed.push('artefacts');
  }

  if (removed.length === 0) {
    console.log(`${c(C.RED, 'Nothing removed')}`);
  } else {
    console.log(`${c(C.BOLD, 'Removed ' + removed.length + ' item(s)')}`);
    for (const r of removed) console.log(` ${c(C.RED, '•' + r)}`);
    console.log();
  }
}