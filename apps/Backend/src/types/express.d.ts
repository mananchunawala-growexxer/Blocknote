import type { AuthenticatedUser } from "@blocknote/shared";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedUser;
      requestId?: string;
    }
  }
}

export {};
