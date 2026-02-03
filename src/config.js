const path = require("path");
const os = require("os");

const config = {
  APP_NAME: "n42",
  API_URL: "https://api.node42.dev",
  WWW_URL: "https://www.node42.dev",

  VALIDATOR_URL: "https://validator.node42.dev",

  API_TIMEOUT_MS: 30000,

  NODE42_DIR: path.join(os.homedir(), ".node42"),
  
  ARTEFACTS_DIR: null,
  TRANSACTIONS_DIR: null,
  VALIDATIONS_DIR: null,
  
  DATABASE_FILE: null,
  TOKENS_FILE: null,
  CONFIG_FILE: null,

  DEFAULT_OUTPUT: "plantuml",
  DEFAULT_FORMAT: "svg",

  EP_SIGNIN: "auth/signin",
  EP_REFRESH: "auth/refresh",
  EP_ME: "users/me",
  EP_DISCOVER: "discover/peppol",
  EP_VALIDATE: "validate"
};

config.ARTEFACTS_DIR = path.join(config.NODE42_DIR, "artefacts", "discovery");
config.TRANSACTIONS_DIR = path.join(config.NODE42_DIR, "artefacts", "transactions");
config.VALIDATIONS_DIR = path.join(config.NODE42_DIR, "artefacts", "validations");

config.DATABASE_FILE = path.join(config.NODE42_DIR, "db.json");
config.TOKENS_FILE = path.join(config.NODE42_DIR, "tokens.json");
config.CONFIG_FILE = path.join(config.NODE42_DIR, "config.json");

module.exports = config;