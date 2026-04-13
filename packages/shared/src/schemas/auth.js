import { z } from "zod";
const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(/\d/, "Password must contain at least one number");
export const registerSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: passwordSchema,
});
export const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email(),
    password: z.string().min(1),
});
export const refreshSchema = z.object({
    refreshToken: z.string().min(1),
});
