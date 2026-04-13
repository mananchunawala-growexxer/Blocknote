import type { PoolClient } from "pg";
import { pool } from "../../lib/db.js";

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface RefreshSessionRecord {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `select id, email, password_hash, created_at, updated_at
     from users
     where email = $1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `select id, email, password_hash, created_at, updated_at
     from users
     where id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function createUser(email: string, passwordHash: string, client?: PoolClient): Promise<UserRecord> {
  const executor = client ?? pool;
  const result = await executor.query<UserRecord>(
    `insert into users (email, password_hash)
     values ($1, $2)
     returning id, email, password_hash, created_at, updated_at`,
    [email, passwordHash],
  );

  return result.rows[0];
}

export async function createRefreshSession(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
  client?: PoolClient,
): Promise<RefreshSessionRecord> {
  const executor = client ?? pool;
  const result = await executor.query<RefreshSessionRecord>(
    `insert into refresh_sessions (user_id, token_hash, expires_at)
     values ($1, $2, $3)
     returning id, user_id, token_hash, expires_at, revoked_at, created_at`,
    [userId, tokenHash, expiresAt],
  );

  return result.rows[0];
}

export async function findRefreshSessionByHash(tokenHash: string): Promise<RefreshSessionRecord | null> {
  const result = await pool.query<RefreshSessionRecord>(
    `select id, user_id, token_hash, expires_at, revoked_at, created_at
     from refresh_sessions
     where token_hash = $1`,
    [tokenHash],
  );

  return result.rows[0] ?? null;
}

export async function revokeRefreshSession(sessionId: string, client?: PoolClient): Promise<void> {
  const executor = client ?? pool;
  await executor.query(
    `update refresh_sessions
     set revoked_at = now()
     where id = $1`,
    [sessionId],
  );
}
