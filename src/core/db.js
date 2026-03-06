/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: MIT
*/

import fs   from 'fs';
import path from 'path';
import { getDbFile } from '../cli/paths.js';


let databaseFile  = getDbFile();
let artefactIndex = null;

function setSource(p) {
  databaseFile = p;
}

function load() {
  if (!fs.existsSync(databaseFile)) return { 
    user:         [],
    transactions: [],
    discovery:    [],
  };
  return JSON.parse(fs.readFileSync(databaseFile, 'utf8'));
}

function save(database) {
  invalidateArtefactIndex();

  const dir = path.dirname(databaseFile);
  fs.mkdirSync(dir, { recursive: true });

  const tmp = databaseFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(database, null, 2), 'utf8');

  try { 
    fs.renameSync(tmp, databaseFile); 
  } catch (e) {
    if (e.code === 'ENOENT') {
      fs.writeFileSync(databaseFile, JSON.stringify(database, null, 2), 'utf8');
    } else {
      throw e;
    }
  }
}

function insert(collection, item) {
  const db = load();
  db[collection] ??= [];
  db[collection].push(item);
  save(db);
}

function update(collection, item, key = 'id') {
  const db = load();
  const idx = db[collection]?.findIndex(x => x[key] === item[key]);
  if (idx < 0) return false;
  db[collection][idx] = { ...db[collection][idx], ...item };
  save(db);
  return true;
}

function upsert(collection, item, key = 'id') {
  const db = load();
  db[collection] ??= [];
  const idx = db[collection].findIndex(x => x[key] === item[key]);
  if (idx >= 0) {
    db[collection][idx] = { ...db[collection][idx], ...item, updatedAt: Date.now() };
  } else {
    db[collection].push({ ...item, createdAt: Date.now() });
  }
  save(db);
}

function replace(collection, value) {
  const db = load();
  db[collection] = value;
  save(db);
}

function set(collection, key, value) {
  const db = load();
  db[collection] ??= {};
  db[collection][key] = value;
  save(db);
}

function remove(collection, keyValue, key = 'id') {
  const db = load();
  db[collection] = (db[collection] ?? []).filter(x => x[key] !== keyValue);
  save(db);
}

function clear(collection) {
  const db = load();
  db[collection] = [];
  save(db);
}

function get(collection) {
  const db = load();
  return db[collection] ?? [];
}

function find(collection, predicate) {
  const db = load();
  return (db[collection] ?? []).filter(predicate);
}

function indexBy(list, key) {
  const map = Object.create(null);
  for (const item of list) {
    const k = item?.[key];
    if (k === null) continue;
    (map[k] ??= []).push(item);
  }
  return map;
}

function indexByFn(list, keyFn) {
  const map = Object.create(null);
  for (const item of list) {
    const k = keyFn(item);
    if (k === null) continue;
    (map[k] ??= []).push(item);
  }
  return map;
}

function indexByMap(list, key) {
  const map = new Map();
  for (const item of list) {
    const k = item?.[key];
    if (k === null) continue;
    const arr = map.get(k) ?? [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}

function getArtefactIndex() {
  if (!artefactIndex) {
    const list = get('artefacts');
    artefactIndex = indexBy(list, 'participantId');
  }
  return artefactIndex;
}

function invalidateArtefactIndex() {
  artefactIndex = null;
}

function artefactsByParticipant(pid) {
  const idx = getArtefactIndex();
  return idx[pid] ?? [];
}

export const db = {
  setSource,
  load,
  save,
  insert,
  update,
  upsert,
  replace,
  set,
  remove,
  clear,
  get,
  find,
  indexBy,
  indexByFn,
  indexByMap,
  getArtefactIndex,
  invalidateArtefactIndex,
  artefactsByParticipant
};