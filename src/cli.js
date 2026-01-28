#!/usr/bin/env node
const { Command } = require("commander");
const { signin } = require("./signin");
const { checkAuth } = require("./auth");
const { getUserInfo } = require("./user");
const { runDiscovery } = require("./discover");
const { clearScreen, startSpinner, validateEnv, validateId} = require("./utils");

const program = new Command();
const pkg = require("../package.json");

program
  .name("n42")
  .description("Command-line interface for eDelivery path discovery and diagnostics")
  .version(pkg.version);

program
  .command("signin")
  .description("Authenticate using username and password and store tokens locally")
  .action(signin);

program
  .command("me")
  .description("returns identity and billing status for the authenticated user.")
  .action(() => {
    const stopSpinner = startSpinner();
    
    checkAuth(); 
    const user = getUserInfo();
    console.log(
      `Authenticated as ${user.userName} <${user.userMail}> (${user.role})`
    );

    stopSpinner();
  });

const discover = program
  .command("discover")
  .description("Discovery and diagnostic tooling for eDelivery paths");

discover
  .command("peppol <environment> <participantId>")
  .description("Resolve the Peppol eDelivery message path")
  .option("--output <type>", "Result type (json | plantuml)", "json")
  .option("--format <format>", "When output=plantuml (svg | text)", "svg")
  .option("--force-https", "Force HTTPS endpoints", true)
  .option("--insecure", "Disable TLS certificate validation", false)
  .option("--fetch-business-card", "Fetch Peppol business card", false)
  .option("--reverse-lookup", "Enable reverse lookup", false)
  .option("--probe-endpoints", "Probe resolved endpoints", false)
  .action((environment, participantId, options) => {

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