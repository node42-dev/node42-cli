const { Command } = require("commander");
const { login, logout, checkAuth, setApiKey, getApiKey, removeApiKey } = require("./auth");
const { getUserWithIndex, getUserUsage } = require("./user");
const { runDiscovery } = require("./discover");
const { runValidation } = require("./validator");
const { startSpinner, validateEnv, validateId, createAppDirs, capitalize, cleanAppDirs } = require("./utils");
const { NODE42_DIR, ARTEFACTS_DIR, DEFAULT_OUTPUT, DEFAULT_FORMAT } = require("./config");

createAppDirs(); 

const program = new Command();
const pkg = require("../package.json");
const db = require("./db");
const C = require("./colors");

const fs = require("fs");
const path = require("path");

program
  .name("n42")
  .description("Node42 CLI for eDelivery path discovery and diagnostics")
  .version(pkg.version);

program
  .command("completion <shell>")
  .description("Install shell completion")
  .action((shell) => {

    if (shell !== "bash") {
      console.error(`${C.RED}Only bash supported${C.RESET}`);
      return;
    }

    const src = path.join(__dirname, "completion/bash.sh");
    const dest = path.join(NODE42_DIR, "completion.bash");
    fs.copyFileSync(src, dest);

    console.log(`${C.DIM}Completion script saved to ${dest}${C.RESET}`);
    console.log(`Run: ${C.BOLD}source ${dest}${C.RESET}\n`);
  });

program
  .command("login")
  .description("Authenticate using username and password and store tokens locally")
  .action(login);

program
  .command("logout")
  .description("Terminate user session and delete all local tokens")
  .action(logout);

program
  .command("apikey")
  .description("Manage API key authentication")
  .option("--set <key>", "Authenticate using an API key")
  .option("--remove", "Remove stored API key")
  .action((options) => {
    const user = getUserWithIndex(0);
    if (!user) {
      console.error(`${C.RED}No local user context found${C.RESET}`);
      process.exit(1);
    }

    console.log(`${C.BOLD}Node42 Account${C.RESET} (${user.userMail})\n`);

    if (options.set) {
      setApiKey(user.id, options.set);

      if (getApiKey(user.id) === options.set) {
        console.log(`${C.GREEN}API key authentication configured${C.RESET}\n`);
      } else {
        console.log(`${C.RED}API key configuration failed${C.RESET}\n`);
      }
      return;
    }

    if (options.remove) {
      const removed = removeApiKey(user.id);
      console.log(removed ? `${C.RED}API key removed${C.RESET}\n` : `${C.RED}No API key configured${C.RESET}\n`);
      return;
    }

    // default: show status
    const apiKey = getApiKey(user.id);
    console.log(apiKey ? `${C.RED}API key configured${C.RESET}\n` : `${C.RED}No API key configured${C.RESET}\n`);
  });

program
  .command("me")
  .description("Returns identity and service usage for the authenticated user.")
  .action(async () => {
    const stopSpinner = startSpinner();
    
    const authenticated = await checkAuth(); 
    stopSpinner();

    if (!authenticated) {
      process.exit(1);
    }
    
    const user = getUserWithIndex(0);
    const currentMonth = new Date().toISOString().slice(0, 7);
    console.log(`Node42 Account: ${C.BOLD}${user.id}${C.RESET}
    ${C.BOLD}User${C.RESET}
      Name         : ${user.userName}
      Email        : ${user.userMail}
      Role         : ${user.role}

    ${C.BOLD}Rate Limits${C.RESET}
      Discovery    : ${C.RED}${user.rateLimits.discovery}${C.RESET}
      Transactions : ${C.RED}${user.rateLimits.transactions}${C.RESET}
      Validation   : ${C.RED}${user.rateLimits.validation}${C.RESET}
  
    ${C.BOLD}Usage${C.RESET} ${C.DIM}(Current Month)${C.RESET}
      Discovery    : ${C.RED}${user.serviceUsage.discovery[currentMonth] ?? 0}${C.RESET}
      Transactions : ${C.RED}${user.serviceUsage.transactions[currentMonth] ?? 0}${C.RESET}
      Validation   : ${C.RED}${user.serviceUsage.validation[currentMonth] ?? 0}${C.RESET}
    `);
  });

program
  .command("usage <service>")
  .description("Returns service usage for the authenticated user.")
  .option("-m, --month <yyyy-mm>", "Show usage for a specific month")
  .action((service, options) => {
    const user = getUserWithIndex(0);
    const currentMonth = options.month ? options.month : new Date().toISOString().slice(0, 7);
    let usage = getUserUsage(user.id, service, currentMonth);
    if (!usage) {
      usage = 0;
    }

    console.log(`${C.BOLD}${capitalize(service)} usage${C.RESET}`);
    console.log(` • ${currentMonth}: ${C.RED}${usage}${C.RESET}\n`);
  });

program
  .command("clean")
  .description("Remove locally stored artefacts and cache")
  .option("--tokens", "Remove stored authentication tokens")
  .option("--artefacts", "Remove artefacts")
  .option("--transactions", "Remove transactions")
  .option("--validations", "Remove validations")
  .option("--db", "Remove local database")
  .option("--all", "Wipe all local data")
  .action((options)=> {
      cleanAppDirs(options);
  });

program
  .command("history [participantId]")
  .description("Show local history with filtering")
  .option("--today", "Show only today's artefacts")
  .option("--day <yyyy-mm-dd>", "Show artefacts for a specific day")
  .option("--last <n>", "Show only last N results", parseInt)
  .action((participantId, options) => {
    let artefacts = participantId
      ? db.artefactsByParticipant(participantId)
      : db.get("artefacts");

    artefacts ??= [];

    // newest first
    artefacts.sort((a, b) => b.createdAt - a.createdAt);

    // ---- DATE FILTER ----
    let dayFilter = null;
    let filterInfo = "";

    if (options.today) {
      dayFilter = new Date().toISOString().slice(0, 10);
      filterInfo = ", created today";
    } else if (options.day) {
      dayFilter = options.day;
      filterInfo = `, created ${options.day}`;
    }

    if (dayFilter) {
      artefacts = artefacts.filter(x =>
        new Date(x.createdAt).toISOString().slice(0, 10) === dayFilter
      );
    }

    // ---- LAST N FILTER ----
    if (options.last && Number.isInteger(options.last) && options.last > 0) {
      artefacts = artefacts.slice(0, options.last);
      filterInfo += `, showing last ${options.last}`;
    }

    if (!artefacts.length) {
      const filter = dayFilter !== null ? ` (${dayFilter})` : ``;
      console.log(`${C.RED}No artefacts found.${C.RESET}${C.DIM}${filter}${C.RESET}\n`);
      return;
    }

    // ---- OUTPUT ----
    console.log(`${C.BOLD}Found ${artefacts.length} artefact(s)${filterInfo}${C.RESET}\n`);

    const DATE = "DATE".padEnd(19);
    const PID = "PID".padEnd(15);
    const FILE = "FILE";
    console.log(`${DATE} ${C.CYAN}${PID}${C.RESET} ${FILE}`);

    for (const item of artefacts) {
      const d = new Date(item.createdAt);
      const iso = d.toISOString();           // 2026-01-30T16:53:28.123Z
      const date = iso.slice(0, 10);         // 2026-01-30
      const time = iso.slice(11, 19);        // 16:53:28
     
      let file;
      let link;
      if (item.file.includes(".svg")) {
        file = path.join(ARTEFACTS_DIR, `${item.file.replace(".svg", ".html")}`);
        link = `\u001B]8;;file://${file}\u0007Open Diagram\u001B]8;;\u0007`;
      } else {
        file = path.join(ARTEFACTS_DIR, `${item.file}`);
        link = `\u001B]8;;file://${file}\u0007Open Artefact\u001B]8;;\u0007`;
      }

      let pid = item.participantId;
      if (!participantId) {
        pid = pid.length > 15 ? pid.substring(0, 12) + "..." : pid
        console.log(`${date} ${C.DIM}${time}${C.RESET} ${C.CYAN}${pid.padEnd(15)}${C.RESET} ${item.file} ${C.BLUE}[${link}]${C.RESET}`);
      } else {
        console.log(`${date} ${C.DIM}${time}${C.RESET} ${item.file} ${C.BLUE}[${link}]${C.RESET}`);
      }
    }

    console.log("");
  });


const discover = program
  .command("discover")
  .description("Discovery and diagnostic tooling for eDelivery paths");

discover
  .command("peppol <participantId>")
  .description("Resolve and validate the full (Peppol) eDelivery path:\nSML/SMK (BDXR DNS) lookup, SMP resolution, endpoint discovery, and TLS diagnostics.")
  .option("-e, --env <environment>", "Environment", "TEST")
  .option("-o, --output <type>", "Result type (json | plantuml)", DEFAULT_OUTPUT)
  .option("-f, --format <format>", "When output=plantuml (svg | text)", DEFAULT_FORMAT)
  .option("--force-https", "Force HTTPS endpoints", true)
  .option("--insecure", "Disable TLS certificate validation", false)
  .option("--fetch-business-card", "Fetch Peppol business card", false)
  .option("--reverse-lookup", "Enable reverse lookup", false)
  .option("--probe-endpoints", "Probe resolved endpoints", false)
  .action((participantId, options) => {
    try { validateEnv(options.env); }
    catch (e) { 
      console.error(e.message);
      process.exit(1);
    }

    try { validateId("participant", participantId); }
    catch (e) { 
      console.error(e.message);
      process.exit(1);
    }

    runDiscovery(participantId, options);
  });

const validate = program
  .command("validate")
  .description("Run document validation using configurable rulesets");

validate
  .command("peppol <document>")
  .description("Validate a document against Peppol validation rulesets")
  .option("-r, --ruleset <ruleset>", "Validation ruleset to use (latest | current | legacy)", "current")
  .option("--location", "Include XPath location for each validation assertion", true)
  .option("--runtime", "Include execution time in the validation output", false)
  .action((document, options) => {
    if (!fs.existsSync(document)) {
      console.error("Couldn't find a valid document at the selected path");
      process.exit(1);
    }

    const xmlDoc = fs.readFileSync(document, "utf8");
    const docName = path.basename(document);

    runValidation(docName, xmlDoc, options);
  });

program.parse(process.argv);