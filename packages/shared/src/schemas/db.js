import { z } from "zod";
export const userSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    password_hash: z.string(),
    created_at: z.date(),
    updated_at: z.date(),
});
export const documentSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    title: z.string().min(1).max(120),
    is_public: z.boolean(),
    share_token_hash: z.string().nullable(),
    current_version: z.number().int(),
    created_at: z.date(),
    updated_at: z.date(),
});
export const blockSchema = z.object({
    id: z.string().uuid(),
    document_id: z.string().uuid(),
    parent_id: z.string().uuid().nullable(),
    type: z.enum(["paragraph", "heading_1", "heading_2", "todo", "code", "divider", "image"]),
    content_json: z.record(z.any()),
    order_index: z.number(),
    created_at: z.date(),
    updated_at: z.date(),
});
export const refreshSessionSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    token_hash: z.string(),
    expires_at: z.date(),
    revoked_at: z.date().nullable(),
    created_at: z.date(),
});
export const shareSessionSchema = z.object({
    id: z.string().uuid(),
    document_id: z.string().uuid(),
    session_token_hash: z.string(),
    expires_at: z.date(),
    revoked_at: z.date().nullable(),
    created_at: z.date(),
});
