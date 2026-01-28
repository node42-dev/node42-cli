const inquirer = require("inquirer");
const readline = require("readline");

function clearScreen(text) {
  process.stdout.write("\x1Bc");
  if (text) {
    process.stdout.write(text + "\n");
  }
}

function ask(question, hidden=false) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

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
            process.stdout.write(question + "*".repeat(rl.line.length));
          }
          break;
      }
    });

    rl.question(question, answer => {
      rl.history = rl.history.slice(1);
      rl.close();
      resolve(answer);
    });
  });
}

function startSpinner(text = "Working") {
  const frames = ["-", "\\", "|", "/"];
  let i = 0;

  const timer = setInterval(() => {
    process.stdout.write("\r[" + frames[i++ % frames.length] + "] " + text);
  }, 120);

  return () => {
    clearInterval(timer);
    process.stdout.write("\r\x1b[K"); // carriage return + clear line
  };
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

module.exports = { clearScreen, startSpinner, ask, buildDocLabel, promptForDocument, validateEnv, validateId };