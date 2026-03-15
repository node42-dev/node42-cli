/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: AGPL-3.0-only
*/

import fs from 'fs';

import { getUserWithIndex } from './user.js';
import { ask }              from '../cli/prompt.js';
import { Spinner }          from '../cli/spinner.js';
import { c, C }             from '../cli/color.js';

import { 
  N42Error, 
  N42ErrorCode, 
  handleApiError 
} from '../core/error.js';

import { API_URL, EP_ME, EP_REFRESH, EP_SIGNIN } from '../core/constants.js';
import { 
  getN42Home,
  getTokensFile 
} from '../cli/paths.js';

import { 
  createDb, 
  getDbAdapter 
} from '../db/db.js';

const spinner = new Spinner();
const tokensFile = getTokensFile();

let db = null;
async function getDb() {
  if (!db) db = createDb(await getDbAdapter());
  return db;
}

async function setApiKey(userId, key) {
  db = await getDb();

  if (!key) return;
  const [u] = await db.find('user', x => x.id === userId);
  if (!u) return;
  u.apiKey = { value: key, createdAt: Date.now() };
  db.upsert('user', { id: userId, apiKey: { value: key, createdAt: Date.now() } });
}

async function getApiKey(userId) {
  db = await getDb();

  const [u] = await db.find('user', x => x.id === userId);
  if (!u || !u.apiKey) return null;
  return u.apiKey.value;
}

async function removeApiKey(userId) {
  db = await getDb();

  const [u] = await db.find('user', x => x.id === userId);
  if (!u || !u.apiKey) return false;
  const { apiKey: _, ...rest } = u;
  db.upsert('user', rest);
  return true;
}

async function fetchWithAuth(url, options = {}) {
  const user   = await getUserWithIndex(0);
  const apiKey = user ? await getApiKey(user.id) : null;

  let { accessToken } = await loadTokens();

  if (!accessToken && !apiKey) {
    throw new N42Error(N42ErrorCode.AUTH_TOKEN_EXPIRED, { details: "Access Token" });
  }

  if (apiKey) {
    console.log(`${c(C.DIM, 'Authenticating with API key')}\n`);
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : apiKey
        ? { 'X-Api-Key': apiKey }
        : {})
    }
  });

  if (apiKey || res.status !== 401) return res;

  const refreshed = await refreshSession();
  if (!refreshed) return res;

  accessToken = await loadTokens().accessToken;
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });
}

async function logout() {
  db = await getDb();

  if (fs.existsSync(tokensFile)) {
    fs.unlinkSync(tokensFile);
  }
  db.clear('user');
  console.log(`${c(C.RED, 'Sign out complete')}\n`);
}

async function loadTokens() {
  if (!fs.existsSync(tokensFile)) {
    throw new N42Error(N42ErrorCode.TOKEN_MISSING, { details: "You are not signed in" });
  }
  return JSON.parse(fs.readFileSync(tokensFile, 'utf8'));
}

async function getMe() {
  if (!fs.existsSync(tokensFile)) {
    throw new N42Error(N42ErrorCode.TOKEN_MISSING, { details: "You are not signed in" });
  }

  const res = await fetchWithAuth(`${API_URL}/${EP_ME}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res) return false;

  if (!res.ok) {
    const err = await res.json();

    handleApiError(err);
    return false;
  }

  const userInfo = await res.json();

  if (userInfo) {
    await db.upsert('user', {
      id:           userInfo.sub,
      userName:     userInfo.userName,
      userMail:     userInfo.userMail,
      role:         userInfo.role,
      rateLimits:   userInfo.rateLimits,
      serviceUsage: userInfo.serviceUsage,
    });
    return true;
  }

  return false;
}

async function login() {
  console.log(`${c(C.BOLD, 'Sign in to your account')}`);
  let user = await getUserWithIndex(0);

  const apiKey = await getApiKey(user.id);
  if (apiKey) {
    console.log(`\n${c(C.RED, 'API key authentication is configured')}`);
    console.log(`Login is not required.\n`);
    return;
  }

  const username = await ask('Username', user.userMail ?? '');
  const password = await ask('Password', null, true);

  console.log();
  spinner.start('Authenticating User');

  const res = await fetch(`${API_URL}/${EP_SIGNIN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    spinner.fail('Authentication Failed');
    throw new N42Error(N42ErrorCode.TOKEN_MISSING, { details: "Invalid credentials" });
  }

  const tokens = await res.json();

  const { accessToken, refreshToken, idToken } = tokens;
  if (!accessToken || !refreshToken || !idToken) {
    spinner.fail('Authentication Failed');
    throw new N42Error(N42ErrorCode.SIGNIN_FAILED, { details: "Token missing" });
  }

  fs.mkdirSync(getN42Home(), { recursive: true });
  fs.writeFileSync(
    tokensFile,
    JSON.stringify({ accessToken, refreshToken, idToken }, null, 2)
  );

  spinner.done('User Authenticated');

  spinner.start('Fetching Account Details');
  const authenticated = await getMe();
 
  if (!authenticated) {
    spinner.fail('Failed to Fetch Account Details');
    throw new N42Error(N42ErrorCode.SIGNIN_FAILED, { details: "Not Authenticated" });
  }

  spinner.done('Account Details Updated');

  user = await getUserWithIndex(0);
  console.log(`\nLogged in as ${user.userName} <${c(C.BLUE, user.userMail)}> ${c(C.DIM, '(' + user.role + ')')}\n`);
}

async function refreshSession() {
  const { refreshToken } = await loadTokens();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/${EP_REFRESH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: refreshToken })
  });

  const data = await res.json();
  if (!res.ok || data.__type) {
    return false;
  }

  if (data) {
    fs.mkdirSync(getN42Home(), { recursive: true });
    fs.writeFileSync(
      tokensFile,
      JSON.stringify({
        accessToken:  data.accessToken,
        refreshToken: data.refreshToken,
        idToken:      data.idToken
      })
    );
  }

  return true;
}

export { fetchWithAuth, setApiKey, getApiKey, removeApiKey, login, logout, loadTokens, getMe };