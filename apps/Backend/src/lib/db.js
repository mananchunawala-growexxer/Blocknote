import pkg from "pg";
import { env } from "../config/env.js";

const { Pool } = pkg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});
