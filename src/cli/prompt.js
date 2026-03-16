
/*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: AGPL-3.0-only
*/

import inquirer from 'inquirer';
import readline from 'readline';
import pkg      from '../../package.json' with { type: 'json' };

import { c, C } from '../cli/color.js';

import { 
  N42Error, 
  N42ErrorCode
} from '../core/error.js';

/* c8 ignore next */
export function printHeader(text, clearScreen=false) {
  if (clearScreen) process.stdout.write('\x1Bc');
  if (text && text.length > 0) {
    process.stdout.write(text + '\n');
  } else {
    process.stdout.write(`Node42 CLI v${pkg.version}`);
  }
}

/* c8 ignore next */
export function ask(question, def, hidden = false) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input:    process.stdin,
      output:   process.stdout,
      terminal: true
    });

    const q = def ? `${question} ${c(C.DIM, '(' + def + ')')}: ` : `${question}: `;

    process.stdin.on('data', chunk => {
      const char = chunk + '';
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          process.stdin.pause();
          break;
        default:
          if (hidden) {
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(q + '*'.repeat(rl.line.length));
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
export async function promptForDocument(docs) {
  const { document } = await inquirer.prompt([
    {
      type:    'list',
      name:    'document',
      message: 'Select document type:',
      choices: docs.map(d => ({ name: d.label, value: d }))
    }
  ]);
  return document;
}

export function validateEnv(env) {
  const allowedEnvs = ['TEST', 'PROD'];
  if (!allowedEnvs.includes(env.toUpperCase())) {
    throw new N42Error(N42ErrorCode.INVALID_INPUT, { details: `Invalid environment: ${env}\nAllowed values: ${allowedEnvs.join(', ')}`});
  }
  return env.toUpperCase();
}

export function validateId(type, id) {
  const value = id.replace(/\s+/g, '');
  if (!/^[0-9]{4}:[a-zA-Z0-9\-._~]{1,135}$/.test(value)) {
    throw new N42Error(N42ErrorCode.INVALID_INPUT, { details: `Invalid ${type}Id: ${id}\nExpected format: 0007:123456789 or 0007:abcd` });
  }
}