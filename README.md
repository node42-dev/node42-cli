# Node42 CLI (n42)

Command-line interface for **eDelivery discovery, diagnostics, and
validation**, with support for the Peppol network.

The Node42 CLI is designed for **system integrators, service providers,
and operators** who need fast, repeatable insight into eDelivery
routing, SMP resolution, and Access Point behavior.

------------------------------------------------------------------------

## Features

-   Peppol eDelivery path discovery
-   SMP and Access Point resolution diagnostics
-   Supported document type detection
-   PlantUML and SVG visualizations
-   Authenticated API access
-   Deterministic, script-friendly output
-   No browser automation or UI side effects

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

------------------------------------------------------------------------

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
DATE                PID             FILE
2026-01-30 15:42:18 9915:helger     ~/.node42/artefacts/discovery/b91f83e2.svg
2026-01-30 15:42:10 9915:helger     ~/.node42/artefacts/discovery/ba1cbc8d.svg
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
-   Explicit `--insecure` flag for testing only
-   Tokens stored locally, never logged

## License

MIT License