import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../lib/db.js";
import { logger } from "../lib/logger.js";

async function run(): Promise<void> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const migrationsDir = path.resolve(currentDir, "../../migrations");
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  const client = await pool.connect();

  try {
    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = await fs.readFile(fullPath, "utf8");
      logger.info({ file }, "Applying migration");
      await client.query(sql);
    }

    logger.info("All migrations applied");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(async (error) => {
  logger.error({ err: error }, "Migration failed");
  await pool.end();
  process.exitCode = 1;
});
