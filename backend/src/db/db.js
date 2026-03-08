import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "pharmacy_system",
  password: process.env.PGPASSWORD || "yourpassword",
  port: Number(process.env.PGPORT || 5432),
});

export default pool;
