const fs = require("fs");

const { NODE42_DIR, TOKENS_FILE, API_URL, EP_SIGNIN } = require("./config");
const { checkAuth } = require("./auth");
const { getUserInfo } = require("./user");
const { clearScreen, ask, startSpinner } = require("./utils");


async function signin() {
  clearScreen("Sign in to Node42");

  const username = await ask("Username: ");
  const password = await ask("Password: ", true);

  let stopSpinner = startSpinner();

  const res = await fetch(`${API_URL}/${EP_SIGNIN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    stopSpinner();

    console.error("Login failed: ", res.status);
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
  const user = getUserInfo();
  console.log(
    `Authenticated as ${user.userName} <${user.userMail}> (${user.role})`
  );
  
  stopSpinner();
}

module.exports = { signin };