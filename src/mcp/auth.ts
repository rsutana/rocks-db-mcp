import jwt from "jsonwebtoken";
import fs from "fs";
import { mysqlPool, config } from "./db.js";

let publicKey: string | null = null;

export function initAuth() {
  if (fs.existsSync(config.publicKeyPath)) {
    publicKey = fs.readFileSync(config.publicKeyPath, "utf8");
  } else {
    console.error("Warning: OAuth public key not found at", config.publicKeyPath);
  }
}

export async function validateToken(token: string) {
  if (!token || !publicKey) {
    if (!publicKey) console.error("Auth Error: Public key not loaded");
    return null;
  }
  
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
