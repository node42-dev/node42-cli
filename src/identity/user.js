/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: MIT
*/

import { 
  createDb, 
  getDbAdapter 
} from '../db/db.js';

let db = null;
async function getDb() {
  if (!db) db = createDb(await getDbAdapter());
  return db;
}

const UNKNOWN_USER = {
  id:       'n/a',
  userName: 'n/a',
  userMail: 'n/a',
  role:     'n/a'
};

export async function getUserWithIndex(index) {
  db = await getDb();
  const users = await db.get('user');
  return users.length ? users[index] : UNKNOWN_USER;
}

export async function getUserWithId(userId) {
  db = await getDb();
  const [u] = await db.find('user', x => x.id === userId);
  return u ?? UNKNOWN_USER;
}

export async function getUserUsage(userId, service, month) {
  db = await getDb();
  const [u] = await db.find('user', x => x.id === userId);
  if (!u) return null;

  u.serviceUsage[service] ??= {};
  return u.serviceUsage[service][month];
}

export async function setUserUsage(userId, service, month, value) {
  db = await getDb();
  const [u] = await db.find('user', x => x.id === userId);
  if (!u) return;

  const serviceUsage = { ...u.serviceUsage, [service]: { ...u.serviceUsage?.[service], [month]: value } };
  await db.upsert('user', { ...u, serviceUsage });
}