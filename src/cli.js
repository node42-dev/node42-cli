#!/usr/bin/env node
const { Command } = require("commander");
const { signin, checkAuth } = require("./auth");
const { getUserInfo, getUserUsage } = require("./user");
const { runDiscovery } = require("./discover");
const { clearScreen, startSpinner, validateEnv, validateId} = require("./utils");
const { NODE42_DIR } = require("./config");

const program = new Command();
const pkg = require("../package.json");

const fs = require("fs");
const path = require("path");
const os = require("os");

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
  .command("signin")
  .description("Authenticate using username and password and store tokens locally")
  .action(signin);

program
  .command("me")
  .description("Returns identity and billing status for the authenticated user.")
  .action(() => {
    const stopSpinner = startSpinner();
    
    checkAuth(); 
    const user = getUserInfo();
    console.log(
      `Authenticated as ${user.userName} <${user.userMail}> (${user.role})`
    );

    stopSpinner();
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
    const environment = options.env;

    clearScreen(`Node42 CLI v${pkg.version}`);
    
    try { validateEnv(environment); }
    catch (e) { 
      console.error(e.message);
      process.exit(1);
    }

    try { validateId("participant", participantId); }
    catch (e) { 
      console.error(e.message);
      process.exit(1);
    }

    runDiscovery(environment.toUpperCase(), participantId, options);
  });

program.parse(process.argv);