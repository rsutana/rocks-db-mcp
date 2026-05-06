const mysql = require("mysql2/promise");
const { Client } = require("pg");
require("dotenv").config();

async function testConnections() {
  console.log("Testing MySQL connection...");
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      port: process.env.MYSQL_PORT,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
    });
    console.log("MySQL Connected!");
    await connection.end();
  } catch (error) {
    console.error("MySQL Connection Failed:", error.message);
  }

  console.log("\nTesting PostgreSQL connection...");
  try {
    const client = new Client({
      host: process.env.PG_HOST,
      port: process.env.PG_PORT,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
    });
    await client.connect();
    console.log("PostgreSQL Connected!");
    await client.end();
  } catch (error) {
    console.error("PostgreSQL Connection Failed:", error.message);
  }
}

testConnections();
