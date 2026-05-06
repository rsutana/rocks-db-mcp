import { z } from "zod";
import { handleQuery } from "../utils.js";

export const executeRead = {
  name: "execute_read",
  definition: {
    description: "Run SELECT queries to fetch data.",
    inputSchema: {
      sql: z.string().describe("The SELECT query to execute"),
      params: z.array(z.any()).optional().describe("Query parameters"),
      db_type: z.enum(["mysql", "pg"]).describe("The database type"),
      auth_token: z.string().describe("Bearer token from rocks-api"),
    },
  },
  handler: async (args: any) => {
    if (!args.sql.trim().toLowerCase().startsWith("select")) {
      return { 
        content: [{ type: "text" as const, text: "Error: execute_read only allows SELECT queries." }], 
        isError: true 
      };
    }
    return handleQuery(args, false);
  }
};
