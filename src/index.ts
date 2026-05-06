import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express, { Request, Response } from "express";
import cors from "cors";
import { config, initDatabases } from "./mcp/db.js";
import { initAuth } from "./mcp/auth.js";
import { registerAllTools, tools } from "./mcp/tools/index.js";

// --- Server Setup ---
const server = new McpServer({
  name: "fullscale-rocks-db",
  version: "1.2.1",
});

// Register all tools from the tools directory
registerAllTools(server);

// --- Main ---

async function main() {
  await initDatabases();
  initAuth();

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
      const tool = tools.find((t) => t.name === name);
      if (tool) {
        const result = await tool.handler(args);
        res.json(result);
      } else {
        res.status(404).json({ error: "Tool not found" });
      }
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
