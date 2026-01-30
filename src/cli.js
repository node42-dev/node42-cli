#!/usr/bin/env node

const { Command } = require("commander");
const { login, logout, checkAuth } = require("./auth");
const { getUser, getUserUsage } = require("./user");
const { runDiscovery } = require("./discover");
const { clearScreen, startSpinner, validateEnv, validateId, createAppDirs } = require("./utils");
const { NODE42_DIR, ARTEFACTS_DIR } = require("./config");

createAppDirs(); 

const program = new Command();
const pkg = require("../package.json");
const db = require("./db");

const fs = require("fs");
const path = require("path");

program
  .name("n42")
  .description("Command-line interface for eDelivery path discovery and diagnostics")
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
  .command("me")
  .description("Returns identity and billing status for the authenticated user.")
  .action(async () => {
    const stopSpinner = startSpinner();
    
    await checkAuth(); 
    const user = getUser();

    stopSpinner();
    
    console.log(
      `Authenticated as ${user.userName} <${user.userMail}> (${user.role})`
    );
  });

program
  .command("usage <service>")
  .description("Returns usage for the authenticated user.")
  .action((service) => {
    const userUsage = getUserUsage();
    const currentMonth = new Date().toISOString().slice(0, 7);

    const usage =
      userUsage?.serviceUsage?.[service]?.[currentMonth] ?? 0;

    clearScreen(`Node42 CLI v${pkg.version}`);
    console.log(`Usage for ${service} (${currentMonth}): ${usage}`);
  });

program
  .command("history <participantId>")
  .description("Show local discovery history for a participant")
  .action((participantId) => {
    const artefacts = db.artefactsByParticipant(participantId);

    for (const item of artefacts) {
      const d = new Date(item.createdAt);
      const dt = d.toISOString().slice(0,19).replace("T"," ");
      const file = path.join(ARTEFACTS_DIR, `${item.id}.${item.format}`);
      console.log(`${dt}: ${file}`);
    }
  });

const discover = program
  .command("discover")
  .description("Discovery and diagnostic tooling for eDelivery paths");

discover
  .command("peppol <participantId>")
  .description("Resolve the Peppol eDelivery message path")
  .option("-e, --env <environment>", "Environment", "TEST")
  .option("-o, --output <type>", "Result type (json | plantuml)", "json")
  .option("-f, --format <format>", "When output=plantuml (svg | text)", "svg")
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