#!/usr/bin/env node

const { Command } = require("commander");
const { login, logout, checkAuth } = require("./auth");
const { getUser, getUserUsage } = require("./user");
const { runDiscovery } = require("./discover");
const { clearScreen, startSpinner, validateEnv, validateId, createAppDirs, getArtefactExt, cleanAppDirs } = require("./utils");
const { NODE42_DIR, ARTEFACTS_DIR, DEFAULT_OUTPUT, DEFAULT_FORMAT } = require("./config");

createAppDirs(); 

const program = new Command();
const pkg = require("../package.json");
const db = require("./db");

const fs = require("fs");
const path = require("path");

program
  .name("n42")
  .description("Node42 Command-line interface for eDelivery path discovery and diagnostics")
  .version(pkg.version);

program
  .command("completion <shell>")
  .description("Install shell completion")
  .action((shell) => {

    if (shell !== "bash") {
      console.error("Only bash supported");
      return;
    }

    const src = path.join(__dirname, "completion/bash.sh");
    const dest = path.join(NODE42_DIR, "completion.bash");
    fs.copyFileSync(src, dest);

    console.log(`Completion script saved to ${dest}`);
    console.log(`Run this once:`);
    console.log(`source ${dest}`);
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
  .command("me")
  .description("Returns identity and billing status for the authenticated user.")
  .action(async () => {
    const stopSpinner = startSpinner();
    
    const authenticated = await checkAuth(); 
    stopSpinner();

    if (!authenticated) {
      console.error("Not authenticated");
      process.exit(1);
    }
    
    const user = getUser();
    const currentMonth = new Date().toISOString().slice(0, 7);
    console.log(`Node42 CLI v${pkg.version}
    User
      ID           : ${user.id}
      Name         : ${user.userName}
      Email        : ${user.userMail}
      Role         : ${user.role}

    Rate Limits
      Discovery    : ${user.rateLimits.discovery}
      Transactions : ${user.rateLimits.transactions}
      Validation   : ${user.rateLimits.validation}
  
    Usage (Current Month)
      Discovery    : ${user.serviceUsage.discovery[currentMonth] ?? 0}
      Transactions : ${user.serviceUsage.transactions[currentMonth] ?? 0}
      Validation   : ${user.serviceUsage.validation[currentMonth] ?? 0}
    `);
  });

program
  .command("usage <service>")
  .description("Returns usage for the authenticated user.")
  .option("-m, --month <yyyy-mm>", "Show usage for a specific month")
  .action((service, options) => {
    const user = getUser();
    const currentMonth = options.month ? options.month : new Date().toISOString().slice(0, 7);
    let usage = getUserUsage(user.id, service, currentMonth);
    if (!usage) {
      usage = 0;
    }

    clearScreen(`Node42 CLI v${pkg.version}`);
    console.log(`Usage for ${service} (${currentMonth}): ${usage}`);
  });

program
  .command("history [participantId]")
  .description("Show local discovery history for a participant")
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
      clearScreen(`Node42 CLI v${pkg.version}`);
      console.log(`No artefacts found. (${dayFilter})`);
      return;
    }

    // ---- OUTPUT ----
    clearScreen(`Node42 CLI v${pkg.version}`);
    console.log(`Found ${artefacts.length} artefact(s)${filterInfo}\n`);

    const DATE = "DATE".padEnd(19);
    const PID = "PID".padEnd(15);
    const FILE = "FILE";
    console.log(`${DATE} ${PID} ${FILE}`);

    for (const item of artefacts) {
      const d = new Date(item.createdAt);
      const dt = d.toISOString().slice(0, 19).replace("T", " ");

      const ext = getArtefactExt(item.output, item.format);
      const file = path.join(ARTEFACTS_DIR, `${item.file}`);

      let pid = item.participantId;
      if (!participantId) {
        pid = pid.length > 15 ? pid.substring(0, 12) + "..." : pid
        console.log(`${dt} ${pid.padEnd(15)} ${file}`);
      } else {
        console.log(`${dt} ${file}`);
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
    clearScreen(`Node42 CLI v${pkg.version}`);
    
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

program.parse(process.argv);