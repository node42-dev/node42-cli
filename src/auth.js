const fs = require("fs");
const { NODE42_DIR, TOKENS_FILE, API_URL, EP_LOGIN, EP_REFRESH } = require("./config");
const { handleError } = require("./errors");
const { updateUserInfo, getUserInfo, updateUserUsage } = require("./user");
const { clearScreen, ask, startSpinner } = require("./utils");


async function login() {
  clearScreen("Sign in to Node42");
  let user = getUserInfo();

  const username = await ask("Username", user.userMail ?? "");
  const password = await ask("Password", null, true);

  console.log(username + ", " + password);

  let stopSpinner = startSpinner();

  const res = await fetch(`${API_URL}/${EP_LOGIN}`, {
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

  const { accessToken, refreshToken, idToken } = tokens;
  if (!accessToken || !refreshToken || !idToken) {
    stopSpinner();

    console.error("Invalid auth response");
    process.exit(1);
  }

  fs.mkdirSync(NODE42_DIR, { recursive: true });
  fs.writeFileSync(
    TOKENS_FILE,
    JSON.stringify({ accessToken, refreshToken, idToken }, null, 2)
  );

  stopSpinner();
  stopSpinner = startSpinner();

  checkAuth();
  user = getUserInfo();
  
  console.log(
    `Authenticated as ${user.userName} <${user.userMail}> (${user.role})`
  );
  
  stopSpinner();
}

function loadAuth() {
  if (!fs.existsSync(TOKENS_FILE)) {
    console.error("Not logged in. Run: n42 login");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8"));
}

async function checkAuth() {
  if (!fs.existsSync(TOKENS_FILE)) {
    handleError({ code: "N42E-9033", message: "Token missing..."})
    process.exit(1);
  }

  const res = await fetchWithAuth(`${API_URL}/users/me`, {
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
    await handleError(err);
    return false;
  }

  const auth = await res.json();
  //console.log(auth);
  if (auth) {  
    updateUserInfo({
      userName: auth.userName,
      userMail: auth.userMail,
      role: auth.role,
    });

    updateUserUsage({ serviceUsage: auth.serviceUsage });
    return true;
  }

  return false;
}

async function refreshSession() {
  const { refreshToken } = loadAuth();
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
  let { accessToken } = loadAuth();
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

  accessToken = loadAuth().accessToken;
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    }
  });
}

module.exports = { login, loadAuth, checkAuth, fetchWithAuth };