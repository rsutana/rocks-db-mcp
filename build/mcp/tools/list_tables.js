import { z } from "zod";
import { handleQuery } from "../utils.js";
import { validateToken } from "../auth.js";
export const listTables = {
    name: "list_tables",
    definition: {
        description: "Allow the AI to see the database schema.",
        inputSchema: {
            db_type: z.enum(["mysql", "pg"]).describe("The database type"),
            auth_token: z.string().describe("Bearer token from rocks-api"),
        },
    },
    handler: async (args) => {
        const user = await validateToken(args.auth_token);
        if (!user)
            return { content: [{ type: "text", text: "Unauthorized" }], isError: true };
        const sql = args.db_type === "mysql"
            ? "SHOW TABLES"
            : "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";
        return handleQuery({ ...args, sql }, false);
    }
};
