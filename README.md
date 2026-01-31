# Node42 CLI (n42)

Command-line interface for **eDelivery discovery, diagnostics, and
validation**, with support for the Peppol network.

The Node42 CLI is designed for **system integrators, service providers,
and operators** who need fast, repeatable insight into eDelivery
routing, SML/SMK, SMP resolution, and Access Point behavior.

------------------------------------------------------------------------

## Features

- Peppol eDelivery path discovery
- SML/SMK, SMP and AP resolution diagnostics
- Supported document type detection
- Discovery trace + diagram (SVG/PlantUML/MD)
- Interactive diagrams with clickable links
- Local artefact history inspection

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

Errors are printed with a clickable reference link:

    https://www.node42.dev/errors?code=XXXX

## Security

-   TLS verification enabled by default
-   Tokens stored locally, never logged

## License

MIT License