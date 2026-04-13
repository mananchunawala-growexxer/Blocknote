import bcrypt from "bcryptjs";
import { ERROR_CODES, type AuthResponse } from "@blocknote/shared";
import { pool } from "../../lib/db.js";
import { ApiError } from "../../lib/api-error.js";
import { hashToken } from "../../lib/crypto.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { BCRYPT_ROUNDS } from "../../constants/auth.js";
import {
  createRefreshSession,
  createUser,
  findRefreshSessionByHash,
  findUserByEmail,
  findUserById,
  revokeRefreshSession,
} from "./auth.repository.js";

function buildAuthResponse(user: { id: string; email: string }, refreshToken: string): AuthResponse {
  return {
    user: {
      id: user.id,
      email: user.email,
    },
    accessToken: signAccessToken(user.id, user.email),
    refreshToken,
  };
}

function getRefreshExpiryDate(): Date {
  const now = new Date();
  now.setDate(now.getDate() + 7);
  return now;
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new ApiError(409, ERROR_CODES.AUTH_EMAIL_TAKEN, "Email is already registered");
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const client = await pool.connect();

  try {
    await client.query("begin");
    const user = await createUser(email, passwordHash, client);
    const finalRefreshToken = signRefreshToken(user.id, user.email);
    await createRefreshSession(user.id, hashToken(finalRefreshToken), getRefreshExpiryDate(), client);
    await client.query("commit");
    return buildAuthResponse(user, finalRefreshToken);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new ApiError(401, ERROR_CODES.AUTH_INVALID_CREDENTIALS, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    throw new ApiError(401, ERROR_CODES.AUTH_INVALID_CREDENTIALS, "Invalid email or password");
  }

  const refreshToken = signRefreshToken(user.id, user.email);
  await createRefreshSession(user.id, hashToken(refreshToken), getRefreshExpiryDate());

  return buildAuthResponse(user, refreshToken);
}

export async function refreshSession(refreshToken: string): Promise<AuthResponse> {
  const payload = verifyRefreshToken(refreshToken);
  const session = await findRefreshSessionByHash(hashToken(refreshToken));

  if (!session || session.revoked_at || session.expires_at < new Date()) {
    throw new ApiError(401, ERROR_CODES.AUTH_UNAUTHORIZED, "Refresh token is invalid or expired");
  }

  const user = await findUserById(payload.sub);
  if (!user) {
    throw new ApiError(401, ERROR_CODES.AUTH_UNAUTHORIZED, "User account no longer exists");
  }

  const client = await pool.connect();

  try {
    await client.query("begin");
    await revokeRefreshSession(session.id, client);
    const nextRefreshToken = signRefreshToken(user.id, user.email);
    await createRefreshSession(user.id, hashToken(nextRefreshToken), getRefreshExpiryDate(), client);
    await client.query("commit");
    return buildAuthResponse(user, nextRefreshToken);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    verifyRefreshToken(refreshToken);
  } catch {
    return;
  }

  const session = await findRefreshSessionByHash(hashToken(refreshToken));
  if (!session || session.revoked_at) {
    return;
  }

  await revokeRefreshSession(session.id);
}
