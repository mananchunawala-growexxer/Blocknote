import { useSyncExternalStore } from "react";

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  user: { id: string; email: string } | null;
}

let state: SessionState = {
  accessToken: null,
  refreshToken: null,
  user: null,
};

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
    state = { accessToken: null, refreshToken: null, user: null };
    emit();
  },
};

export function useSession<T>(selector: (value: SessionState) => T): T {
  return useSyncExternalStore(sessionStore.subscribe, () => selector(sessionStore.getSnapshot()));
}
