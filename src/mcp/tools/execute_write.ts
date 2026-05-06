import { z } from "zod";
import { handleQuery } from "../utils.js";

export const executeWrite = {
  name: "execute_write",
  definition: {
    description: "Run INSERT, UPDATE, or DELETE operations.",
    inputSchema: {
      sql: z.string().describe("The INSERT, UPDATE, or DELETE query to execute"),
      params: z.array(z.any()).optional().describe("Query parameters"),
      db_type: z.enum(["mysql", "pg"]).describe("The database type"),
      auth_token: z.string().describe("Bearer token from rocks-api"),
    },
  },
  handler: async (args: any) => {
    return handleQuery(args, true);
  }
};
