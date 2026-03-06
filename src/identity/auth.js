/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: MIT
*/

import fs from 'fs';

import { getUserWithIndex } from './user.js';
import { ask }              from '../cli/prompt.js';
import { Spinner }          from '../cli/spinner.js';
import { C }                from '../cli/color.js';
import { db }               from '../core/db.js';

import { 
  N42Error, 
  N42ErrorCode, 
  handleApiError 
} from '../core/error.js';

import { API_URL, EP_ME, EP_REFRESH, EP_SIGNIN } from '../core/constants.js';
import { getTokensFile, N42_HOME } from '../cli/paths.js';

const spinner = new Spinner();
const tokensFile = getTokensFile();

function setApiKey(userId, key) {
  if (!key) return;
  const database = db.load();
  const u = database.user.find(x => x.id === userId);
  if (!u) return;
  u.apiKey = { value: key, createdAt: Date.now() };
  db.save(database);
}

function getApiKey(userId) {
  const database = db.load();
  const u = database.user.find(x => x.id === userId);
  if (!u || !u.apiKey) return null;
  return u.apiKey.value;
}

function removeApiKey(userId) {
  const database = db.load();
  const u = database.user.find(x => x.id === userId);
  if (!u || !u.apiKey) return false;
  delete u.apiKey;
  db.save(database);
  return true;
}

async function fetchWithAuth(url, options = {}) {
  const user   = getUserWithIndex(0);
  const apiKey = user ? getApiKey(user.id) : null;

  let { accessToken } = loadTokens();

  if (!accessToken && !apiKey) {
    throw new N42Error(N42ErrorCode.AUTH_TOKEN_EXPIRED, { details: "Access Token" });
  }

  if (apiKey) {
    console.log(`${C.DIM}Authenticating with API key.${C.RESET}\n`);
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

  accessToken = loadTokens().accessToken;
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });
}

function logout() {
  if (fs.existsSync(tokensFile)) {
    fs.unlinkSync(tokensFile);
  }
  db.clear('user');
  console.log(`${C.RED}Sign out complete${C.RESET}\n`);
}

function loadTokens() {
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
    db.upsert('user', {
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
  console.log(`${C.BOLD}Sign in to your account${C.RESET}`);
  let user = getUserWithIndex(0);

  const apiKey = getApiKey(user.id);
  if (apiKey) {
    console.log(`\n${C.RED}API key authentication is configured.${C.RESET}`);
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

  fs.mkdirSync(N42_HOME, { recursive: true });
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

  user = getUserWithIndex(0);
  console.log(`\nLogged in as ${user.userName} <${C.BLUE}${user.userMail}${C.RESET}> ${C.DIM}(${user.role})${C.RESET}\n`);
}

async function refreshSession() {
  const { refreshToken } = loadTokens();
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
    fs.mkdirSync(N42_HOME, { recursive: true });
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