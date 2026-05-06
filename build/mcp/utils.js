import { validateToken } from "./auth.js";
import { mysqlPool, pgClient } from "./db.js";
export async function handleQuery(args, isWrite) {
    const user = await validateToken(args.auth_token);
    if (!user) {
        return {
            content: [{ type: "text", text: "Error: Unauthorized. Invalid or expired token." }],
            isError: true,
        };
    }
    const isAdmin = user.roles.includes("superadministrator") || user.roles.includes("administrator");
    if (isWrite && !isAdmin) {
        return {
            content: [{ type: "text", text: `Error: User role '${user.roles.join(", ")}' is not authorized for write operations.` }],
            isError: true,
        };
    }
    try {
        if (args.db_type === "mysql") {
            const [rows] = await mysqlPool.query(args.sql, args.params || []);
            return { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] };
        }
        else {
            const result = await pgClient.query(args.sql, args.params || []);
            return { content: [{ type: "text", text: JSON.stringify(result.rows, null, 2) }] };
        }
    }
    catch (error) {
        return {
            content: [{ type: "text", text: `Database error: ${error.message}` }],
            isError: true,
        };
    }
}
