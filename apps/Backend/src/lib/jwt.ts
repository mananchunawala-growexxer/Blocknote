import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { AUTH_TOKEN_TYPE_ACCESS, AUTH_TOKEN_TYPE_REFRESH } from "../constants/auth.js";

interface TokenPayload {
  sub: string;
  email: string;
  type: string;
}

export function signAccessToken(userId: string, email: string): string {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"],
  };

  return jwt.sign({ sub: userId, email, type: AUTH_TOKEN_TYPE_ACCESS }, env.JWT_ACCESS_SECRET, {
    ...options,
  });
}

export function signRefreshToken(userId: string, email: string): string {
  const options: SignOptions = {
    expiresIn: env.REFRESH_TOKEN_TTL as SignOptions["expiresIn"],
  };

  return jwt.sign({ sub: userId, email, type: AUTH_TOKEN_TYPE_REFRESH }, env.JWT_REFRESH_SECRET, {
    ...options,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}
