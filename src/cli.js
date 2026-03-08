/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: MIT
*/

import './env.js';
import pkg  from '../package.json' with { type: 'json' };

import { registerCommands as registerEdeliveryCommands } from '@n42/edelivery';
import { registerCommands } from './commands.js';
import { initWorkspace }    from './cli/paths.js';

initWorkspace();

import { Command } from 'commander';
const program = new Command();

program
  .name('n42')
  .description('Node42 CLI — eDelivery diagnostics')
  .version(pkg.version);

const edelivery = program.command('edelivery').description('Peppol eDelivery tools');
registerEdeliveryCommands(edelivery);

registerCommands(program);

program.parse(process.argv);