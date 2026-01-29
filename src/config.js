const fs = require("fs");
const path = require("path");
const os = require("os");

const config = {
  APP_NAME: "n42",
  API_URL: "https://api.node42.dev",
  WWW_URL: "https://www.node42.dev",
  API_TIMEOUT_MS: 30000,

  NODE42_DIR: path.join(os.homedir(), ".node42"),
  
  ARTEFACTS_DIR: null,
  TRANSACTIONS_DIR: null,
  VALIDATION_DIR: null,
  
  USAGE_FILE: null,
  USER_FILE: null,
  TOKENS_FILE: null,
  CONFIG_FILE: null,

  DEFAULT_OUTPUT: "json",
  DEFAULT_FORMAT: "svg",

  EP_SIGNIN: "auth/signin",
  EP_REFRESH: "auth/refresh",
  EP_DISCOVER: "discover/peppol"
};

config.ARTEFACTS_DIR = path.join(config.NODE42_DIR, "artefacts", "discovery");
config.TRANSACTIONS_DIR = path.join(config.NODE42_DIR, "artefacts", "transactions");
config.VALIDATION_DIR = path.join(config.NODE42_DIR, "artefacts", "validation");

config.USER_FILE = path.join(config.NODE42_DIR, "user.json");
config.USAGE_FILE = path.join(config.NODE42_DIR, "usage.json");
config.TOKENS_FILE = path.join(config.NODE42_DIR, "tokens.json");
config.CONFIG_FILE = path.join(config.NODE42_DIR, "config.json");

function createAppDirs() {
  fs.mkdirSync(config.NODE42_DIR, { recursive: true });

  fs.mkdirSync(config.ARTEFACTS_DIR, { recursive: true });
  fs.mkdirSync(config.TRANSACTIONS_DIR, { recursive: true });
  fs.mkdirSync(config.VALIDATION_DIR, { recursive: true });

  fs.writeFileSync(
    config.CONFIG_FILE,
    JSON.stringify(config, null, 2)
  );
}

createAppDirs();

module.exports = config;
