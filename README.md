[![CI](https://github.com/node42-dev/node42-cli/actions/workflows/ci.yaml/badge.svg)](https://github.com/node42-dev/node42-cli/actions/workflows/ci.yaml)
[![codecov](https://codecov.io/gh/node42-dev/node42-cli/graph/badge.svg)](https://codecov.io/gh/node42-dev/node42-cli)
[![npm](https://img.shields.io/npm/v/@n42/cli.svg)](https://www.npmjs.com/package/@n42/cli)
[![Swagger](https://img.shields.io/badge/Swagger-Discovery%20API-green)](https://node42.dev/docs/discovery)

# Node42 CLI

Command-line frontend for Node42 **eDelivery path discovery**, diagnostics and validation with support for the Peppol network.

The Node42 CLI is a **scriptable command-line client** to the **Node42 WebUI and API**, 
built for **system integrators**, **service providers**, and **operators** who need fast,
repeatable insight into eDelivery routing, SML/SMK, SMP resolution, and Access Point behavior.

It exposes the **same capabilities as the Node42 WebUI** but optimized for automation
and local analysis.

While Node42's toolset **includes** modules capable of constructing and **sending
standards-compliant messages**, it is **intended for diagnostics**, validation,
and testing — not for production message exchange.

## Features

- Peppol eDelivery path discovery
- SML/SMK, SMP and AP resolution diagnostics
- Supported document type detection
- Discovery trace + diagram (SVG/PlantUML/MD)
- Interactive diagrams with clickable links
- Local artefact history inspection

## Architecture

The Node42 CLI `n42` is a Node.js-based diagnostic tool designed for fast, deterministic execution.

Core command logic lives in `src/`, with each command implemented as a focused module (e.g. `discover`, `validate`). Shared concerns such as configuration, output formatting, persistence, and utilities are isolated in dedicated helpers.

Static assets and shell completions are bundled at build time and distributed with the CLI. Tests mirror the source structure and exercise both command behavior and internal helpers.

Each CLI invocation performs a bounded set of operations and exits; the tool does not run background services or maintain long-lived runtime state beyond persisted history and configuration stored in `~/.node42`.


## Installation

### Requirements

-   Node.js **18+** (Node 20 recommended)
-   npm

### Install globally

``` bash
npm install -g @n42/cli
```

Verify installation:

``` bash
n42 --version
```

------------------------------------------------------------------------

## Authentication

Authenticate once using your Node42 account credentials.\
Tokens are stored locally under `~/.node42/tokens.json`.

``` bash
n42 login
```

Check authentication status:

``` bash
n42 me
```

## Configuration

Configuration and cached data are stored under `~/.node42`

``` bash
~/.node42/
├── artefacts
│   ├── discovery
│   ├── transactions
│   └── validations
├── assets
├── config.json
├── db.json
└── tokens.json
```

## Help

```bash
n42 --help
n42 discover --help
```

## Peppol Discovery

### Basic discovery

``` bash
n42 discover peppol <participantId>
```

#### Available options:
- **-e**, **--env** `<environment>`  Environment (TEST | PROD)
- **-o**, **--output** `<type>`      Result type (json | plantuml)
- **-f**, **--format** `<format>`    When output=plantuml (svg | text)
- **--force-https**            Force HTTPS endpoints
- **--insecure**               Disable TLS certificate validation
- **--fetch-business-card**    Fetch Peppol business card
- **--reverse-lookup**         Enable reverse lookup
- **--probe-endpoints**        Probe resolved endpoints

### History

``` bash
n42 history <participantId>
```

Example output:

```bash
Found 2 artefact(s)

DATE                PID             FILE
2026-01-30 16:53:28 9930:de81347... 5e0800fc.svg [Open]
2026-01-30 16:53:08 9930:de81347... 6eeb73d0.svg [Open]
```

#### Available options:
- **--today**               Show only today's artefacts
- **--day** `<yyyy-mm-dd>`  Show artefacts for a specific day
- **--last** `<n>`          Show only last N results

------------------------------------------------------------------------

## Artefacts

Artefacts are stored under:

    ~/.node42/artefacts/

------------------------------------------------------------------------

## Error Handling

Errors are printed with a clickable reference link.

Example output:

``` bash
Error: 9031 [View details]

Invalid token: the authorization token provided is invalid
``` 

## Security

-   TLS verification enabled by default
-   Tokens stored locally, never logged

## License

MIT License

## Author

Alex Olsson \
Node42