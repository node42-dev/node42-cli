const fs = require("fs");
const { NODE42_DIR, TOKENS_FILE, API_URL, EP_SIGNIN, EP_REFRESH, EP_ME } = require("./config");
const { handleError } = require("./errors");
const { getUserWithIndex } = require("./user");
const { clearScreen, ask, startSpinner } = require("./utils");
const db = require("./db");


async function login() {
  clearScreen("Sign in to Node42");
  let user = getUserWithIndex(0);

  const username = await ask("Username", user.userMail ?? "");
  const password = await ask("Password", null, true);
  //console.log(username + ", " + password);

  let stopSpinner = startSpinner();

  const res = await fetch(`${API_URL}/${EP_SIGNIN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    stopSpinner();
    
    console.error(`Login failed (${res.status}) – Invalid credentials`);
    process.exit(1);
  }

  const tokens = await res.json();
  stopSpinner();
  
  const { accessToken, refreshToken, idToken } = tokens;
  if (!accessToken || !refreshToken || !idToken) {
    console.error("Invalid auth response");
    process.exit(1);
  }

  fs.mkdirSync(NODE42_DIR, { recursive: true });
  fs.writeFileSync(
    TOKENS_FILE,
    JSON.stringify({ accessToken, refreshToken, idToken }, null, 2)
  );

  stopSpinner = startSpinner();

  const authenticated = await checkAuth();
  stopSpinner();

  if (!authenticated) {
    console.error("Not authenticated");
    process.exit(1);
  }

  user = getUserWithIndex(0);
  console.log(
    `Authenticated as ${user.userName} <${user.userMail}> (${user.role})`
  );
}

function logout() {
  if (fs.existsSync(TOKENS_FILE)) {
    fs.unlinkSync(TOKENS_FILE);
  }
  db.clear("user");
}

function loadTokens() {
  if (!fs.existsSync(TOKENS_FILE)) {
    console.error("Tokens missing...\nRun: n42 login");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));
}

async function checkAuth() {
  if (!fs.existsSync(TOKENS_FILE)) {
    handleError({ code: "N42E-9033", message: "Token missing..."})
    return false;
  }

  const res = await fetchWithAuth(`${API_URL}/${EP_ME}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

  if (!res) { 
    return false;
  }

  if (!res.ok) {
    const err = await res.json();
    handleError(err);
    return false;
  }

  const userInfo = await res.json();
  //console.log(userInfo);
  
  if (userInfo) {  
    db.upsert("user", {
      id: userInfo.sub,
      userName: userInfo.userName,
      userMail: userInfo.userMail,
      role: userInfo.role,
      rateLimits: userInfo.rateLimits,
      serviceUsage: userInfo.serviceUsage,
    })
    return true;
  }

  return false;
}

async function refreshSession() {
  const { refreshToken } = loadTokens();
  if (!refreshToken) {
    return false;
  }

  const payload = {
    token: refreshToken,
  };

  const res = await fetch(`${API_URL}/${EP_REFRESH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  //console.log(data);

  if (!res.ok || data.__type) {
    //console.log(data);
    return false;
  }

  if (data) {
    fs.mkdirSync(NODE42_DIR, { recursive: true });
    fs.writeFileSync(
      TOKENS_FILE,
      JSON.stringify({ 
        accessToken: data.accessToken, 
        refreshToken: data.refreshToken,
        idToken: data.idToken 
      })
    );
  }

  return true;
}

async function fetchWithAuth(url, options = {}) {
  let { accessToken } = loadTokens();
  if (!accessToken) {
    handleError({ code: "N42E-9032" });
    return;
  }

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    }
  });

  if (res.status !== 401) {
    return res;
  }

  const refreshed = await refreshSession();
  if (!refreshed) { // N42E-9033
    return res;
  }

  accessToken = loadTokens().accessToken;
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });
}

module.exports = { login, logout, loadTokens, checkAuth, fetchWithAuth };