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
  
  DATABASE_FILE: null,
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

config.DATABASE_FILE = path.join(config.NODE42_DIR, "db.json");
config.TOKENS_FILE = path.join(config.NODE42_DIR, "tokens.json");
config.CONFIG_FILE = path.join(config.NODE42_DIR, "config.json");

module.exports = config;