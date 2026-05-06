import { validateToken } from "./auth.js";
import { mysqlPool, pgClient } from "./db.js";

export async function handleQuery(args: any, isWrite: boolean) {
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
