import type { Request, Response } from "express";
import { loginSchema, refreshSchema, registerSchema } from "@blocknote/shared";
import { login, logout, refreshSession, register } from "./auth.service.js";

export async function registerController(req: Request, res: Response): Promise<void> {
  const input = registerSchema.parse(req.body);
  const response = await register(input.email, input.password);
  res.status(201).json(response);
}

export async function loginController(req: Request, res: Response): Promise<void> {
  const input = loginSchema.parse(req.body);
  const response = await login(input.email, input.password);
  res.status(200).json(response);
}

export async function refreshController(req: Request, res: Response): Promise<void> {
  const input = refreshSchema.parse(req.body);
  const response = await refreshSession(input.refreshToken);
  res.status(200).json(response);
}

export async function logoutController(req: Request, res: Response): Promise<void> {
  const input = refreshSchema.parse(req.body);
  await logout(input.refreshToken);
  res.status(204).send();
}
