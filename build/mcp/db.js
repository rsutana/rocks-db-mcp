import mysql from "mysql2/promise";
import pg from "pg";
import dotenv from "dotenv";
// Silence dotenv logging which pollutes stdout and breaks Stdio transport
dotenv.config({ quiet: true });
export const config = {
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
export let mysqlPool;
export let pgClient;
export async function initDatabases() {
    mysqlPool = mysql.createPool(config.mysql);
    pgClient = new pg.Client(config.pg);
    await pgClient.connect();
    console.error("Databases initialized successfully");
}
