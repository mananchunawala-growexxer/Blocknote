import dotenv from "dotenv";
import { z } from "zod";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findEnvPath(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(currentDir, ".env");
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }
    currentDir = parentDir;
  }
}

const discoveredEnvPath = findEnvPath(process.cwd()) ?? findEnvPath(__dirname);
if (discoveredEnvPath) {
  dotenv.config({ path: discoveredEnvPath });
} else {
  dotenv.config();
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().min(2),
  REFRESH_TOKEN_TTL: z.string().min(2),
  CORS_ORIGIN: z.string().min(1),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid or missing environment variables:", parsed.error.flatten().fieldErrors);
  throw parsed.error;
}

export const env = parsed.data;
