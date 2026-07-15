# LINDAS MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that enables LLMs to query structured data from **LINDAS** — the Swiss Federal Archives' Linked Data platform at `https://ld.admin.ch`.

LINDAS stores multi-dimensional statistical data as RDF cubes using the [cube.link](https://cube.link/) vocabulary, accessible via a SPARQL endpoint backed by Stardog. This server translates high-level tool calls into SPARQL queries and returns clean, LLM-friendly JSON.

## What this enables

Ask an LLM questions about Swiss federal data and let it discover, inspect, and query datasets automatically:

- "Show me forest fire danger warnings in the last week"
- "Compare population across all cantons for 2023"
- "Find datasets about unemployment"

The LLM uses the tools below to discover cubes, inspect their structure, find valid dimension values, and query observations — all without writing SPARQL.

## Prerequisites

- Node.js ≥ 20
- npm or pnpm

## Installation

```bash
npm install
npm run build
```

## Configuration

Environment variables (all optional):

| Variable | Default | Description |
|---|---|---|
| `LINDAS_SPARQL_ENDPOINT` | `https://ld.admin.ch/query` | SPARQL endpoint URL |
| `LINDAS_DEFAULT_LANGUAGE` | `de` | Default language for labels (`de`, `fr`, `it`, `en`) |
| `LINDAS_TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` |
| `LINDAS_PORT` | `3000` | HTTP port (only used when transport is `http`) |
| `LINDAS_HOST` | `0.0.0.0` | HTTP bind address (only used when transport is `http`) |

Command-line flags override environment variables:

```
lindas-mcp [--transport stdio|http] [--port PORT]
```

## Usage with Claude Desktop

Add the server to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lindas": {
      "command": "node",
      "args": ["C:/path/to/lindas-mcp/dist/index.js"],
      "env": {
        "LINDAS_DEFAULT_LANGUAGE": "de"
      }
    }
  }
}
```

For development with hot reload, use `tsx`:

```json
{
  "mcpServers": {
    "lindas": {
      "command": "npx",
      "args": ["tsx", "C:/path/to/lindas-mcp/src/index.ts"]
    }
  }
}
```

## HTTP Transport (Streamable HTTP)

For use with the MCP Inspector, web-based clients, or remote access, start the server in HTTP mode:

```bash
# Using npm scripts
npm run start:http          # node dist/index.js --transport http
npm run dev:http            # tsx src/index.ts --transport http

# Or directly
node dist/index.js --transport http --port 3000
```

The server exposes the MCP Streamable HTTP endpoint at `http://127.0.0.1:3000/mcp`.

In HTTP mode, each client session gets its own MCP server instance. The server tracks sessions via the `Mcp-Session-Id` header.

### MCP Inspector

To inspect the server interactively, open the MCP Inspector and connect to:

```
http://127.0.0.1:3000/mcp
```

Or launch the Inspector with the server:

```bash
npx @modelcontextprotocol/inspector node dist/index.js --transport stdio
```

### opencode

For HTTP mode in opencode, configure `opencode.json`:

```json
{
  "mcp": {
    "lindas": {
      "type": "remote",
      "url": "http://127.0.0.1:3000/mcp",
      "enabled": true
    }
  }
}
```

### LibreChat / Docker

Build the Docker image and add it to your `docker-compose.yml`:

```yaml
services:
  lindas-mcp:
    image: lindas-mcp
    container_name: lindas-mcp
    environment:
      - LINDAS_TRANSPORT=http
      - LINDAS_PORT=8000
      - LINDAS_DEFAULT_LANGUAGE=de
    restart: unless-stopped
    # ports:                    # Only needed for host access
    #   - "8000:8000"
```

Then in LibreChat's config:

```yaml
mcpServers:
  lindas:
    type: streamable-http
    url: http://lindas-mcp:8000/mcp
```

Make sure both containers share the same Docker network.

## Available Tools

### Discovery & Search

| Tool | Description | Key Parameters |
|---|---|---|
| `list_cubes` | List available data cubes | `limit`, `offset` |
| `search_datasets` | Full-text search across cube titles/descriptions | `query`, `limit` |
| `get_cube_metadata` | Get publisher, license, status, temporal coverage, and other metadata for a cube | `cube_uri` |
| `get_cube_versions` | List all versions of a cube | `cube_uri` |
| `get_cube_structure` | Get dimensions/measures/datatypes of a cube | `cube_uri` |
| `get_dimension_summary` | Get all dimensions with value counts and available ranges — single-call overview instead of calling `get_dimension_values` for each dimension separately | `cube_uri`, `language` |

### Querying

| Tool | Description | Key Parameters |
|---|---|---|
| `query_observations` | Query observations with filters, pagination, and optional label resolution | `cube_uri`, `dimensions`, `measures`, `filters`, `resolve_labels`, `limit`, `offset`, `language` |
| `count_observations` | Count observations (check size before query) | `cube_uri`, `filters` |
| `count_observations_by_dimension` | Break down observation counts by dimension values (e.g., how many per canton per year) | `cube_uri`, `dimension`, `filters`, `limit`, `language` |
| `get_page_info` | Get pagination metadata for a query — total count, hasMore, nextPageOffset | `cube_uri`, `dimensions`, `measures`, `filters`, `limit`, `offset` |

### Geography

| Tool | Description | Key Parameters |
|---|---|---|
| `get_cantons` | List all 26 Swiss cantons with IRIs and names | `language` |
| `get_municipalities` | List Swiss municipalities with IRIs and names (optionally filtered by canton) | `canton_iri`, `language` |
| `get_districts` | List Swiss districts with IRIs and names (optionally filtered by canton) | `canton_iri`, `language` |
| `resolve_geography` | Resolve a place name to its LINDAS IRI | `name`, `language` |
| `resolve_iri` | Look up a LINDAS IRI to get its label and type | `iri`, `language` |

### Resources

- `lindas:///cubes` — Catalogue of available data cubes (Markdown)

### Prompts

- `data_exploration` — Step-by-step guide for exploring LINDAS data
- `canton_comparison` — Compare a topic across cantons for a given year (args: `topic`, `year`)

## Typical Workflow

The recommended workflow for an LLM using this server:

1. **`search_datasets`** or **`list_cubes`** — Find cubes matching the user's topic
2. **`get_cube_structure`** — Inspect the cube's dimensions and measures
3. **`get_dimension_summary`** — Get a quick overview of all dimensions with value counts (replaces calling `get_dimension_values` for each dimension separately)
4. **`resolve_geography`** — If the user mentions a place name, resolve it to an IRI
5. **`resolve_iri`** — If query results contain opaque IRIs, look up their labels
6. **`count_observations`** — Check how many results the query will return
7. **`query_observations`** — Retrieve the data (use `resolve_labels: true` to get human-readable labels instead of IRIs)

For geographic comparisons, use **`get_cantons`**, **`get_municipalities`**, or **`get_districts`** to list geographic entities with their IRIs.

## `resolve_labels` Feature

When `query_observations` is called with `resolve_labels: true`, IRI-valued dimensions are automatically joined to their `schema:name` labels. Instead of receiving:

```json
{ "canton": { "value": "https://ld.admin.ch/canton/1", "label": "https://ld.admin.ch/canton/1" } }
```

You receive:

```json
{ "canton": { "value": "https://ld.admin.ch/canton/1", "label": "Zürich" } }
```

This makes results immediately understandable without additional lookups.

## Development

```bash
npm run dev          # Start stdio transport with tsx (hot reload)
npm run dev:http     # Start HTTP transport with tsx (hot reload)
npm run build        # Compile with tsc
npm start            # Run compiled stdio server
npm run start:http   # Run compiled HTTP server
npm test             # Run unit tests (vitest)
npm run test:watch   # Watch mode
```

### Project Structure

```
src/
├── index.ts              # MCP server entry point (stdio + HTTP)
├── config.ts             # Configuration constants
├── sparql/
│   ├── client.ts         # SPARQL HTTP client + SparqlError
│   ├── queryBuilder.ts   # Pure SPARQL query builder functions
│   └── resultParser.ts   # SPARQL JSON → domain object parsers
├── tools/
│   ├── index.ts          # Tool registration + dispatch
│   └── *.ts              # Individual tool handlers
├── resources/
│   └── catalogue.ts      # lindas:///cubes resource
└── prompts/
    └── templates.ts      # Prompt templates
tests/
├── sparql.test.ts        # Query builder unit tests
└── resultParser.test.ts  # Parser unit tests
```

## Notes

- All logging goes to **stderr** (stdout is reserved for the MCP protocol in stdio mode).
- User input interpolated into SPARQL is escaped to prevent injection.
- Result limit is capped at 500 to protect LLM context windows.
- Labels are fetched via `schema:name` with language filtering; IRI-valued dimensions fall back to the IRI itself if no label is found.
- The `search_datasets` tool uses `CONTAINS` filters on `schema:name` and `schema:description` (the Stardog `textMatch` predicate is not supported on the public LINDAS endpoint).
- In HTTP mode, each client session gets its own MCP server instance. Sessions are tracked via the `Mcp-Session-Id` header and cleaned up on disconnect.

## License

MIT