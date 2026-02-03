
const inquirer = require("inquirer");
const readline = require("readline");

const fs = require("fs");
const path = require("path");

const config = require("./config");
const pkg = require("../package.json");
const db = require("./db");
const C = require("./colors");

/* c8 ignore next */
function writeHeader(text, clearScreen=false) {
  if (clearScreen) {
    process.stdout.write("\x1Bc");
  }
  if (text && text.length > 0) {
    process.stdout.write(text + "\n");
  } else {
     process.stdout.write(`Node42 CLI v${pkg.version}`);
  }
}

/* c8 ignore next */
function ask(question, def, hidden=false) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    const q = def ? `${question} ${C.DIM}(${def})${C.RESET}: ` : `${question}: `;

    process.stdin.on("data", char => {
      char = char + "";
      switch (char) {
        case "\n":
        case "\r":
        case "\u0004":
          process.stdin.pause();
          break;
        default:
          if (hidden) {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(q + "*".repeat(rl.line.length));
          }
          break;
      }
    });

    rl.question(q, answer => {
      rl.history = rl.history.slice(1);
      rl.close();
      resolve(answer || def);
    });
  });
}

/* c8 ignore next */
function startSpinner(text = "Working") {
  const frames = ["-", "\\", "|", "/"];
  let i = 0;

  const timer = setInterval(() => {
    const frame = frames[i++ % frames.length];
    process.stdout.write(`\r[${C.RED_BOLD}${frame}${C.RESET}] ${text}`);
  }, 120);

  return () => {
    clearInterval(timer);
    process.stdout.write("\r\x1b[K"); // carriage return + clear line
  };
}

/* c8 ignore next */
async function promptForDocument(docs) {
  const { document } = await inquirer.prompt([
    {
      type: "list",
      name: "document",
      message: "Select document type:",
      choices: docs.map(d => ({
        name: d.label,
        value: d
      }))
    }
  ]);

  return document;
}

function validateEnv(env) {
  const allowedEnvs = ["TEST", "PROD"];
  if (!allowedEnvs.includes(env.toUpperCase())) {
    throw new Error(
      `Invalid environment: ${env}\nAllowed values: ${allowedEnvs.join(", ")}`
    );
  }
}

function validateId(type, id) {
  const value = id.replace(/\s+/g, "");

  // ISO 6523–safe; participant id like 0000:12345 or 9915:abcde
  if (!/^[0-9]{4}:[a-zA-Z0-9\-\._~]{1,135}$/.test(value)) {
    throw new Error(
      `Invalid ${type}Id: ${id}\nExpected format: 0007:123456789 or 0007:abcd`
    );
  }
}

/* c8 ignore next */
function getShortId(id) {
  return id.slice(0, 8);
}

/* c8 ignore next */
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function createAppDirs(force=false) {
  fs.mkdirSync(config.NODE42_DIR, { recursive: true });
  fs.mkdirSync(config.ARTEFACTS_DIR, { recursive: true });
  fs.mkdirSync(config.TRANSACTIONS_DIR, { recursive: true });
  fs.mkdirSync(config.VALIDATIONS_DIR, { recursive: true });

  const wrapperSrc = path.join(__dirname, "assets");
  const wrapperDest = path.join(config.NODE42_DIR, "assets");
  fs.cpSync(wrapperSrc, wrapperDest, { recursive: true });

  if (!fs.existsSync(config.CONFIG_FILE) || force) {
    fs.writeFileSync(
      config.CONFIG_FILE,
      JSON.stringify({
        DEFAULT_OUTPUT: config.DEFAULT_OUTPUT,
        DEFAULT_FORMAT: config.DEFAULT_FORMAT
      }, null, 2)
    );
  }
}

function cleanAppDirs(options) {
  const {
    tokens,
    artefacts,
    transactions,
    validations,
    db: dbFlag,
    all
  } = options;

  if (Object.keys(options).length === 0) {
    console.log(`${C.RED}Nothing to clean${C.RESET}`);
    return;
  }

  const removed = [];

  if ((all || tokens) && fs.existsSync(config.TOKENS_FILE)) {
    fs.unlinkSync(config.TOKENS_FILE);
    removed.push("tokens");
  }

  if ((all || dbFlag) && fs.existsSync(config.DATABASE_FILE)) {
    fs.unlinkSync(config.DATABASE_FILE);
    removed.push("database");
  }

  if (all || artefacts) {
    try {
      db.clear("artefacts");
    } catch {}

    if (fs.existsSync(config.ARTEFACTS_DIR)) {
      fs.rmSync(config.ARTEFACTS_DIR, { recursive: true, force: true });
      fs.mkdirSync(config.ARTEFACTS_DIR, { recursive: true });
    }
    removed.push("artefacts");
  }

  if (all || transactions) {
    try {
      db.clear("transactions");
    } catch {}

    if (fs.existsSync(config.TRANSACTIONS_DIR)) {
      fs.rmSync(config.TRANSACTIONS_DIR, { recursive: true, force: true });
      fs.mkdirSync(config.TRANSACTIONS_DIR, { recursive: true });
    }
    removed.push("transactions");
  }

  if (all || validations) {
    try {
      db.clear("validations");
    } catch {}

    if (fs.existsSync(config.VALIDATIONS_DIR)) {
      fs.rmSync(config.VALIDATIONS_DIR, { recursive: true, force: true });
      fs.mkdirSync(config.VALIDATIONS_DIR, { recursive: true });
    }
    removed.push("validations");
  }

  if (removed.length === 0) {
    console.log(`${C.RED}Nothing removed${C.RESET}`);
  } else {
    console.log(`${C.BOLD}Removed ${removed.length} item(s)${C.RESET}`);
    for (const r of removed) {
      console.log(` ${C.RED}• ${r}${C.RESET}`);
    }

    console.log();
  }
}

function buildDocLabel({ scheme, value }) {
  // 1. Document name (after :: before ##)
  const docMatch = value.match(/::([^#]+)##/);
  const docName = docMatch ? docMatch[1].replace(/([A-Z])/g, " $1").trim() : "Document";

  // 2. Wildcard
  if (value.endsWith("##*")) {
    return `Any ${docName} (Wildcard)`;
  }

  // 3. PINT profile
  if (value.includes(":pint:")) {
    const regionMatch = value.match(/@([a-z0-9-]+)/i);
    const region = regionMatch
      ? regionMatch[1].replace(/-1$/, "").toUpperCase()
      : "PINT";

    const prefix = scheme === "peppol-doctype-wildcard" ? "Wildcard" : "PINT";
    return `${docName} (${prefix} ${region})`;
  }

  // 4. BIS profile
  if (value.includes(":bis:") || value.includes("en16931")) {
    const bisMatch = value.match(/bis:[^:]+:(\d+)/);
    const version = bisMatch ? bisMatch[1] : "3";
    return `${docName} (BIS ${version})`;
  }

  // 4. TRNS profile
  if (value.includes(":trns:")) {
    const trnsMatch = value.match(/:trns:([^:]+):([\d.]+)/);
    const version = trnsMatch ? ` ${trnsMatch[2]}` : "";
    return `${docName} (TRNS${version})`;
  }

  // 5. Fallback
  return docName;
}

function getArtefactExt(output, format) {
  if (output === "plantuml" && format === "svg") {
    return "svg";
  } else if (output === "plantuml" && format === "text") {
    return "puml"
  } else {
    return "json";
  }
}

module.exports = { writeHeader, startSpinner, ask, buildDocLabel, promptForDocument, validateEnv, validateId, getShortId, capitalize, createAppDirs, cleanAppDirs, getArtefactExt };