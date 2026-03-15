/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: AGPL-3.0-only
*/

import fs   from 'fs';
import path from 'path';

import { N42Timer }          from './cli/timer.js';
import { N42Context }        from './model/context.js';
import { N42Environment }    from './model/environment.js';
import { runDiscovery }   from './discover.js';
import { runValidation }  from './validator.js';
import { capitalize }     from './core/utils.js';
import { Spinner }        from './cli/spinner.js';
import { c, C }           from './cli/color.js';

import { 
  validateEnv, 
  validateId 
} from './cli/prompt.js'; 

import { 
  initShellCompletion,
  getUserDiscoveryDir,
  cleanAppDirs
}  from './cli/paths.js'

import { 
  N42Error,
  N42ErrorCode,
  handleError 
} from './core/error.js';

import { 
  login, 
  logout, 
  getMe, 
  setApiKey, 
  getApiKey, 
  removeApiKey 
} from './identity/auth.js';

import { 
  getUserWithIndex, 
  getUserUsage 
} from './identity/user.js';

import { 
  DEFAULT_FORMAT,
  DEFAULT_OUTPUT 
} from './core/constants.js';

import { 
  createDb, 
  getDbAdapter 
} from './db/db.js';

let db = null;
async function getDb() {
  if (!db) db = createDb(await getDbAdapter());
  return db;
}

const runtimeEnv = new N42Environment();
const timer = new N42Timer();

/**
 * Register CLI commands on the commander program instance.
 * @param {import('commander').Command} program
 */
export function registerCommands(program) {
    program
    .command("completion <shell>")
    .description("Install shell completion")
    .action((shell) => {
        if (shell !== "bash") {
            throw new N42Error(N42ErrorCode.INVALID_INPUT, { details: `Only bash supported` });
        }
        initShellCompletion();
    });

    program
    .command('login')
    .description('Authenticate using username and password and store tokens locally')
    .action(async () => {
        try { await login(); }
        catch(e) {
            if (e instanceof N42Error) {
                console.log(e.pretty());
                process.exit(1);
            }
            console.log(e); 
        }
    });

    program
    .command('logout')
    .description('Terminate user session and delete all local tokens')
    .action(logout);

    program
    .command('apikey')
    .description('Manage API key authentication')
    .option('--set <key>', 'Authenticate using an API key')
    .option('--remove', 'Remove stored API key')
    .action(async (options) => {
        const user = await getUserWithIndex(0);
        if (!user) {
            console.error(`${c(C.RED, 'No local user context found')}`);
            process.exit(1);
        }

        console.log(`${c(C.BOLD, 'Node42 Account')} (${user.userMail})\n`);

        if (options.set) {
            setApiKey(user.id, options.set);
            if (getApiKey(user.id) === options.set) {
                console.log(`${c(C.GREEN, 'API key authentication configured')}\n`);
            } else {
                console.log(`${c(C.RED, 'API key configuration failed')}\n`);
            }
            return;
        }

        if (options.remove) {
            const removed = removeApiKey(user.id);
            console.log(removed ? `${c(C.RED, 'API key removed')}\n` : `${c(C.RED, 'No API key configured')}\n`);
            return;
        }

        const apiKey = getApiKey(user.id);
        console.log(apiKey ? `${c(C.RED, 'API key configured')}\n` : `${c(C.RED, 'No API key configured')}\n`);
    });

    program
    .command('me')
    .description('Returns identity and service usage for the authenticated user.')
    .action(async () => {
        const spinner = new Spinner();

        try {
            const user = await getUserWithIndex(0);
            console.log(`Node42 Account: ${c(C.BOLD, user.id)}`);
            console.log();

            spinner.start('Fetching Account Details');
            const authenticated = await getMe();
            if (!authenticated) {
                spinner.fail('Failed to Fetch Account Details');
                process.exit(1);
            }
            spinner.done('Account Details Updated');
            console.log();

            const currentMonth = new Date().toISOString().slice(0, 7);

            console.log(`${c(C.BOLD, 'ACCOUNT DETAILS')}
    ${c(C.BOLD, 'User')}
    Name         : ${user.userName}
    Email        : ${user.userMail}
    Role         : ${user.role}

    ${c(C.BOLD, 'Rate Limits')}
    Discovery    : ${c(C.RED, user.rateLimits.discovery)}
    Transactions : ${c(C.RED, user.rateLimits.transactions)}
    Validation   : ${c(C.RED, user.rateLimits.validation)}

    ${c(C.BOLD, 'Usage')} ${c(C.DIM, '(Current Month')}
    Discovery    : ${c(C.RED, user.serviceUsage.discovery[currentMonth] ?? 0)}
    Transactions : ${c(C.RED, user.serviceUsage.transactions[currentMonth] ?? 0)}
    Validation   : ${c(C.RED, user.serviceUsage.validation[currentMonth] ?? 0)}
        `);
        }
        catch(e) {
            spinner.fail('Failed to Fetch Account Details');
            handleError(e);
        }
    });

    program
    .command('usage <service>')
    .description('Returns service usage for the authenticated user.')
    .option('-m, --month <yyyy-mm>', 'Show usage for a specific month')
    .action(async (service, options) => {
        const user         = await getUserWithIndex(0);
        const currentMonth = options.month ?? new Date().toISOString().slice(0, 7);
        const usage        = await getUserUsage(user.id, service, currentMonth) ?? 0;

        console.log(`${c(C.BOLD, capitalize(service))} usage`);
        console.log(` • ${currentMonth}: ${c(C.RED, usage)}\n`);
    });

    program
    .command('clean')
    .description('Remove locally stored artefacts and cache')
    .option('--tokens',       'Remove stored authentication tokens')
    .option('--artefacts',    'Remove artefacts')
    .option('--discovery',    'Remove discovery')
    .option('--transactions', 'Remove transactions')
    .option('--validations',  'Remove validations')
    .option('--db',           'Remove local database')
    .option('--all',          'Wipe all local data')
    .action(async (options) => {
        await cleanAppDirs(options);
    });

    program
    .command('history [participantId]')
    .description('Show local history with filtering')
    .option('--today',          "Show only today's artefacts")
    .option('--day <yyyy-mm-dd>', 'Show artefacts for a specific day')
    .option('--last <n>',       'Show only last N results', parseInt)
    .action(async (participantId, options) => {
        db = await getDb();

        try {
            let artefacts = participantId
            ? await db.artefactsByParticipant('Discovery', participantId)
            : await db.getAll('Discovery');

            artefacts ??= [];
            artefacts.sort((a, b) => b.createdAt - a.createdAt);

            let dayFilter  = null;
            let filterInfo = '';

            if (options.today) {
                dayFilter  = new Date().toISOString().slice(0, 10);
                filterInfo = ', created today';
            } else if (options.day) {
                dayFilter  = options.day;
                filterInfo = `, created ${options.day}`;
            }

            if (dayFilter) {
                artefacts = artefacts.filter(x =>
                    new Date(x.createdAt).toISOString().slice(0, 10) === dayFilter
                );
            }

            if (options.last && Number.isInteger(options.last) && options.last > 0) {
                artefacts  = artefacts.slice(0, options.last);
                filterInfo += `, showing last ${options.last}`;
            }

            if (!artefacts.length) {
                const filter = dayFilter !== null ? ` (${dayFilter})` : '';
                console.log(`${c(C.RED, 'No artefacts found')}. ${c(C.DIM, filter)}\n`);
                return;
            }

            console.log(`${c(C.BOLD, 'Found ' + artefacts.length + ' artefact(s)' + filterInfo)}\n`);

            const DATE = 'DATE'.padEnd(19);
            const PID  = 'PID'.padEnd(15);
            const FILE = 'FILE';

            console.log(`${DATE} ${c(C.CYAN, PID)} ${FILE}`);

            for (const item of artefacts) {
                const iso  = new Date(item.createdAt).toISOString();
                const date = iso.slice(0, 10);
                const time = iso.slice(11, 19);

                let file, link;
                if (item.file.includes('.svg')) {
                    file = path.join(getUserDiscoveryDir(), `${item.file.replace('.svg', '.html')}`);
                    link = `\u001B]8;;file://${file}\u0007Diagram\u001B]8;;\u0007`;
                } else {
                    file = path.join(getUserDiscoveryDir(), `${item.file}`);
                    link = `\u001B]8;;file://${file}\u0007Artefact\u001B]8;;\u0007`;
                }

                let pid = item.participantId;
                if (!participantId) {
                    pid = pid.length > 15 ? pid.substring(0, 12) + '...' : pid;
                    console.log(`${date} ${c(C.DIM, time)} ${c(C.CYAN, pid.padEnd(15))} ${item.file} [${c(C.BLUE, link)}]`);
                } else {
                    console.log(`${date} ${c(C.DIM, time)} ${item.file} [${c(C.BLUE, link)}]`);
                }
            }
            console.log();
        }
        catch(e) {
            handleError(e);
        }
    });

    const discover = program
    .command('discover')
    .description('Discovery and diagnostic tooling for eDelivery paths');

    discover
    .command('peppol <participantId>')
    .description('Resolve and validate the full (Peppol) eDelivery path:\nSML/SMK (BDXR DNS) lookup, SMP resolution, endpoint discovery, and TLS diagnostics.')
    .option('-e, --env <environment>',    'Environment', 'TEST')
    .option('-o, --output <type>',        'Result type (json | plantuml)', DEFAULT_OUTPUT)
    .option('-f, --format <format>',      'When output=plantuml (svg | text)', DEFAULT_FORMAT)
    .option('--force-https',              'Force HTTPS endpoints', true)
    .option('--insecure',                 'Disable TLS certificate validation', false)
    .option('--fetch-business-card',      'Fetch Peppol business card', false)
    .option('--reverse-lookup',           'Enable reverse lookup', false)
    .option('--probe-endpoints',          'Probe resolved endpoints', false)
    .option('--ai [mode]',                'Enable AI interpretation (summary | diagnostic | compliance)')
    .option('--ai-execution [mode]',      'AI execution mode: sync embeds interpretation, async embeds reference ID')
    .action(async (participantId, options) => {
        const spinner = new Spinner();
        const context = new N42Context({
            spinner,
            runtimeEnv,
            participantId,
            options,
        });

        try { 
            validateEnv(options.env);
            validateId('participant', participantId);

            await runDiscovery(context); 
        }
        catch(e) {
            handleError(e);
            process.exit(1);
        }
    });

    const validate = program
    .command('validate')
    .description('Run document validation using configurable rulesets');

    validate
    .command('peppol <document>')
    .description('Validate a document against Peppol validation rulesets')
    .option('-r, --ruleset <ruleset>', 'Validation ruleset to use (latest | current | legacy)', 'current')
    .option('--location',             'Include XPath location for each validation assertion', true)
    .option('--runtime',              'Include execution time in the validation output', false)
    .action((document, options) => {
        const spinner = new Spinner();
        const context = new N42Context({
            spinner,
            runtimeEnv,
            options,
        });
        
        try { 
            if (!fs.existsSync(document)) {
                throw new N42Error(N42ErrorCode.DOC_NOT_FOUND, { details: document });
            }

            context.docXml  = fs.readFileSync(document, 'utf8');
            context.docName = path.basename(document);

            runValidation(context);
        } 
        catch(e) {
            handleError(e);
            process.exit(1);
        }
  });
}