import { z } from "zod";
import { handleQuery } from "../utils.js";
import { validateToken } from "../auth.js";
export const describeTable = {
    name: "describe_table",
    definition: {
        description: "Get details about specific table columns.",
        inputSchema: {
            table_name: z.string().describe("Name of the table to describe"),
            db_type: z.enum(["mysql", "pg"]).describe("The database type"),
            auth_token: z.string().describe("Bearer token from rocks-api"),
        },
    },
    handler: async (args) => {
        const user = await validateToken(args.auth_token);
        if (!user)
            return { content: [{ type: "text", text: "Unauthorized" }], isError: true };
        const sql = args.db_type === "mysql"
            ? `DESCRIBE \`${args.table_name}\``
            : `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1`;
        const params = args.db_type === "pg" ? [args.table_name] : [];
        return handleQuery({ ...args, sql, params }, false);
    }
};
