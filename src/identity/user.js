/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: MIT
*/

import { db } from '../core/db.js';

const UNKNOWN_USER = {
  id:       'n/a',
  userName: 'n/a',
  userMail: 'n/a',
  role:     'n/a'
};

export function getUserWithIndex(index) {
  const users = db.get('user');
  return users.length ? users[index] : UNKNOWN_USER;
}

export function getUserWithId(userId) {
  const database = db.load();
  return database.user.find(x => x.id === userId) ?? UNKNOWN_USER;
}

export function getUserUsage(userId, service, month) {
  const database = db.load();
  const u = database.user.find(x => x.id === userId);
  if (!u) return null;
  u.serviceUsage[service] ??= {};
  return u.serviceUsage[service][month];
}

export function setUserUsage(userId, service, month, value) {
  const database = db.load();
  const u = database.user.find(x => x.id === userId);
  if (!u) return;
  u.serviceUsage[service] ??= {};
  u.serviceUsage[service][month] = value;
  db.save(database);
}