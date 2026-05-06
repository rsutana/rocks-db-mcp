# Setup Guide: Fullscale Rocks MCP Server

This guide explains how to install, configure, and start the MCP server for the `fullscale-rocks` database.

## 1. Installation

If you haven't already, install the dependencies:

```bash
cd rocks-mcp
npm install
```

## 2. Configuration

The server requires database credentials and an OAuth public key.

### Database Settings
Create or edit `rocks-mcp/.env`:

```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=employee
MYSQL_USER=employee
MYSQL_PASSWORD=thisisapassword

PG_HOST=127.0.0.1
PG_PORT=5432
PG_DATABASE=employee
PG_USER=employee
PG_PASSWORD=thisisapassword

SSE_PORT=3001
```

### Authentication
The server automatically looks for the OAuth public key at:
`/home/ryscript/fullscale-rocks/rocks-api/storage/oauth-public.key`

Ensure this file exists, as it is used to verify JWT tokens from `rocks-api`.

## 3. Running the Server

### Development Mode
Runs the server with `tsx` (reloads on file changes):
```bash
npm run dev
```

### Production Mode
Build the TypeScript code and start the built version:
```bash
npm run build
npm start
```

## 4. Connecting to AI Applications

### Claude Desktop
Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rocks-db": {
      "command": "node",
      "args": ["/home/ryscript/fullscale-rocks/rocks-mcp/build/index.js"]
    }
  }
}
```

### Generic MCP Client (SSE)
The server also supports Server-Sent Events (SSE) for remote or web-based clients.

- **SSE URL**: `http://localhost:3001/sse`
- **Post Message URL**: `http://localhost:3001/message`

You can use this with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) or other SSE-compatible clients.


## 5. Tools Reference

The server exposes the following tools:

| Tool | Purpose | Requirements |
|---|---|---|
| `execute_read` | Run `SELECT` queries | `auth_token`, `db_type` |
| `execute_write` | Run `INSERT/UPDATE/DELETE` | `auth_token` (Admin only), `db_type` |
| `list_tables` | List all tables | `auth_token`, `db_type` |
| `describe_table`| Show columns for a table | `auth_token`, `db_type`, `table_name` |

---
**Note**: The `auth_token` should be a valid Bearer token obtained from the `rocks-api` login process.
