import { z } from "zod";

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(120).default("Untitled"),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(120),
});
