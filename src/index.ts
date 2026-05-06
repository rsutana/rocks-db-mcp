import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import mysql from "mysql2/promise";
import pg from "pg";
import jwt from "jsonwebtoken";
import fs from "fs";
import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";

// Silence dotenv logging which pollutes stdout and breaks Stdio transport
dotenv.config({ quiet: true } as any); 

// --- Configuration ---
const config = {
  mysql: {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    user: process.env.MYSQL_USER || "employee",
    password: process.env.MYSQL_PASSWORD || "thisisapassword",
    database: process.env.MYSQL_DATABASE || "employee",
  },
  pg: {
    host: process.env.PG_HOST || "127.0.0.1",
    port: parseInt(process.env.PG_PORT || "5432"),
    user: process.env.PG_USER || "employee",
    password: process.env.PG_PASSWORD || "thisisapassword",
    database: process.env.PG_DATABASE || "employee",
  },
  publicKeyPath: "/home/ryscript/fullscale-rocks/rocks-api/storage/oauth-public.key",
  ssePort: parseInt(process.env.SSE_PORT || "3001"),
};

// --- State ---
let mysqlPool: mysql.Pool;
let pgClient: pg.Client;
let publicKey: string | null = null;

async function initDatabases() {
  mysqlPool = mysql.createPool(config.mysql);
  pgClient = new pg.Client(config.pg);
  await pgClient.connect();

  if (fs.existsSync(config.publicKeyPath)) {
    publicKey = fs.readFileSync(config.publicKeyPath, "utf8");
  } else {
    console.error("Warning: OAuth public key not found at", config.publicKeyPath);
  }
}

// --- Auth Logic ---
async function validateToken(token: string) {
  if (!token || !publicKey) return null;
  const tokenValue = token.startsWith("Bearer ") ? token.slice(7) : token;

  try {
    const decoded = jwt.verify(tokenValue, publicKey, { algorithms: ["RS256"] }) as any;
    const userId = decoded.sub;
    const jti = decoded.jti;

    const [tokenRows]: any = await mysqlPool.query(
      "SELECT * FROM oauth_access_tokens WHERE id = ? AND revoked = 0 AND expires_at > NOW()",
      [jti]
    );

    if (tokenRows.length === 0) return null;

    const [userRows]: any = await mysqlPool.query("SELECT * FROM users WHERE id = ?", [userId]);
    if (userRows.length === 0) return null;

    const user = userRows[0];
    const [roleRows]: any = await mysqlPool.query(
      `SELECT r.name FROM roles r
       JOIN role_user ru ON ru.role_id = r.id
       WHERE ru.user_id = ? AND ru.user_type = 'App\\\\Models\\\\User'`,
      [user.id]
    );
    user.roles = roleRows.map((r: any) => r.name);
    return user;
  } catch (error: any) {
    console.error("Token verification failed:", error.message);
    return null;
  }
}

// --- Server Setup ---
const server = new McpServer({
  name: "fullscale-rocks-db",
  version: "1.2.1",
});

// --- Common Tool Logic ---
async function handleQuery(args: any, isWrite: boolean) {
  const user = await validateToken(args.auth_token);
  if (!user) {
    return {
      content: [{ type: "text" as const, text: "Error: Unauthorized. Invalid or expired token." }],
      isError: true,
    };
  }

  const isAdmin = user.roles.includes("superadministrator") || user.roles.includes("administrator");
  if (isWrite && !isAdmin) {
    return {
      content: [{ type: "text" as const, text: `Error: User role '${user.roles.join(", ")}' is not authorized for write operations.` }],
      isError: true,
    };
  }

  try {
    if (args.db_type === "mysql") {
      const [rows] = await mysqlPool.query(args.sql, args.params || []);
      return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
    } else {
      const result = await pgClient.query(args.sql, args.params || []);
      return { content: [{ type: "text" as const, text: JSON.stringify(result.rows, null, 2) }] };
    }
  } catch (error: any) {
    return {
      content: [{ type: "text" as const, text: `Database error: ${error.message}` }],
      isError: true,
    };
  }
}

// --- Tools ---

server.registerTool(
  "execute_read",
  {
    description: "Run SELECT queries to fetch data.",
    inputSchema: {
      sql: z.string().describe("The SELECT query to execute"),
      params: z.array(z.any()).optional().describe("Query parameters"),
      db_type: z.enum(["mysql", "pg"]).describe("The database type"),
      auth_token: z.string().describe("Bearer token from rocks-api"),
    },
  },
  async (args: any) => {
    if (!args.sql.trim().toLowerCase().startsWith("select")) {
      return { content: [{ type: "text" as const, text: "Error: execute_read only allows SELECT queries." }], isError: true };
    }
    return handleQuery(args, false);
  }
);

server.registerTool(
  "execute_write",
  {
    description: "Run INSERT, UPDATE, or DELETE operations.",
    inputSchema: {
      sql: z.string().describe("The INSERT, UPDATE, or DELETE query to execute"),
      params: z.array(z.any()).optional().describe("Query parameters"),
      db_type: z.enum(["mysql", "pg"]).describe("The database type"),
      auth_token: z.string().describe("Bearer token from rocks-api"),
    },
  },
  async (args: any) => {
    return handleQuery(args, true);
  }
);

server.registerTool(
  "list_tables",
  {
    description: "Allow the AI to see the database schema.",
    inputSchema: {
      db_type: z.enum(["mysql", "pg"]).describe("The database type"),
      auth_token: z.string().describe("Bearer token from rocks-api"),
    },
  },
  async (args: any) => {
    const user = await validateToken(args.auth_token);
    if (!user) return { content: [{ type: "text" as const, text: "Unauthorized" }], isError: true };

    const sql = args.db_type === "mysql" 
      ? "SHOW TABLES" 
      : "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";
    
    return handleQuery({ ...args, sql }, false);
  }
);

server.registerTool(
  "describe_table",
  {
    description: "Get details about specific table columns.",
    inputSchema: {
      table_name: z.string().describe("Name of the table to describe"),
      db_type: z.enum(["mysql", "pg"]).describe("The database type"),
      auth_token: z.string().describe("Bearer token from rocks-api"),
    },
  },
  async (args: any) => {
    const user = await validateToken(args.auth_token);
    if (!user) return { content: [{ type: "text" as const, text: "Unauthorized" }], isError: true };

    const sql = args.db_type === "mysql"
      ? `DESCRIBE \`${args.table_name}\``
      : `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1`;
    
    const params = args.db_type === "pg" ? [args.table_name] : [];
    
    return handleQuery({ ...args, sql, params }, false);
  }
);

// --- Main ---

async function main() {
  await initDatabases();

  const app = express();
  app.use(cors());
  app.use(express.json());

  // 1. SSE Transport
  let sseTransport: SSEServerTransport | null = null;
  app.get("/sse", async (req: Request, res: Response) => {
    console.error("New SSE connection");
    sseTransport = new SSEServerTransport("/message", res);
    await server.connect(sseTransport);
  });

  app.post("/message", async (req: Request, res: Response) => {
    if (sseTransport) {
      await sseTransport.handlePostMessage(req, res);
    } else {
      res.status(400).send("No active SSE connection");
    }
  });

  // 2. HTTP Transport (Direct POST calls)
  app.post("/tool/:name", async (req: Request, res: Response) => {
    const { name } = req.params;
    const args = req.body;

    try {
      let result;
      switch (name) {
        case "execute_read":
          if (!args.sql?.trim().toLowerCase().startsWith("select")) {
            result = { content: [{ type: "text" as const, text: "Error: execute_read only allows SELECT queries." }], isError: true };
          } else {
            result = await handleQuery(args, false);
          }
          break;
        case "execute_write":
          result = await handleQuery(args, true);
          break;
        case "list_tables":
          const sqlList = args.db_type === "mysql" ? "SHOW TABLES" : "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";
          result = await handleQuery({ ...args, sql: sqlList }, false);
          break;
        case "describe_table":
          const sqlDesc = args.db_type === "mysql" ? `DESCRIBE \`${args.table_name}\`` : `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1`;
          const paramsDesc = args.db_type === "pg" ? [args.table_name] : [];
          result = await handleQuery({ ...args, sql: sqlDesc, params: paramsDesc }, false);
          break;
        default:
          res.status(404).json({ error: "Tool not found" });
          return;
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Status endpoint
  app.get("/status", (req, res) => {
    res.json({ status: "ok", name: "fullscale-rocks-db", version: "1.2.1" });
  });

  app.listen(config.ssePort, () => {
    console.error(`HTTP/SSE Server running on port ${config.ssePort}`);
  });

  // 3. Stdio Transport
  const stdioTransport = new StdioServerTransport();
  await server.connect(stdioTransport);
  // Do NOT use console.log here. console.error is safe as it goes to stderr.
  console.error("Rocks MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
