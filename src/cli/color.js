 /*
  Author: Alex Olsson
  Copyright (C) 2026 Node42 (www.node42.dev)
  Email: a1exnd3r@node42.dev
  GitHub: https://github.com/node42-dev
  SPDX-License-Identifier: MIT
*/

 export const C = {
  RESET:        '\x1b[0m',
  BLACK:        '\x1b[30m',
  RED:          '\x1b[31m',
  DARK_RED:   '\x1b[31m',
  GREEN:        '\x1b[32m',
  DARK_GREEN: '\x1b[32m',
  YELLOW:       '\x1b[33m',
  ORANGE:       '\x1b[38;5;214m',
  GRAY:         '\x1b[38;5;244m',
  BLUE:         '\x1b[34m',
  MAGENTA:      '\x1b[35m',
  CYAN:         '\x1b[36m',
  WHITE:        '\x1b[37m',
  BOLD:         '\x1b[1m',
  DIM:          '\x1b[2m',
  UNDERLINE:    '\x1b[4m',
  RED_BOLD:     '\x1b[1;31m',
  GREEN_BOLD:   '\x1b[1;32m',
  YELLOW_BOLD:  '\x1b[1;33m',
  BLUE_BOLD:    '\x1b[1;34m',
  MAGENTA_BOLD: '\x1b[1;35m',
  CYAN_BOLD:    '\x1b[1;36m',

 };

export const c = (color, text) => `${color}${text}${C.RESET}`;