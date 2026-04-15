import { useSyncExternalStore } from "react";

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  user: { id: string; email: string } | null;
}

const SESSION_STORAGE_KEY = "blocknote:session";

const EMPTY_SESSION: SessionState = {
  accessToken: null,
  refreshToken: null,
  user: null,
};

function getInitialSession(): SessionState {
  if (typeof window === "undefined") {
    return EMPTY_SESSION;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return EMPTY_SESSION;
    }

    const parsed = JSON.parse(raw) as Partial<SessionState>;
    const user =
      parsed.user && typeof parsed.user.id === "string" && typeof parsed.user.email === "string"
        ? { id: parsed.user.id, email: parsed.user.email }
        : null;
    const accessToken = typeof parsed.accessToken === "string" ? parsed.accessToken : null;
    const refreshToken = typeof parsed.refreshToken === "string" ? parsed.refreshToken : null;

    return {
      accessToken,
      refreshToken,
      user,
    };
  } catch {
    return EMPTY_SESSION;
  }
}

function persistSession(nextState: SessionState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const hasSession = Boolean(nextState.accessToken || nextState.refreshToken || nextState.user);
    if (!hasSession) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextState));
  } catch {
    // Ignore storage failures and keep in-memory session working.
  }
}

let state: SessionState = getInitialSession();

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function setSession(nextState: Partial<SessionState>) {
  state = {
    ...state,
    ...nextState,
  };
  persistSession(state);
  emit();
}

export const sessionStore = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setSession,
  clear: () => {
    state = EMPTY_SESSION;
    persistSession(state);
    emit();
  },
};

export function useSession<T>(selector: (value: SessionState) => T): T {
  return useSyncExternalStore(sessionStore.subscribe, () => selector(sessionStore.getSnapshot()));
}
