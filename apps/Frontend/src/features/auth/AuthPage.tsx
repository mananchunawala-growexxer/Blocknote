import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, register } from "../../lib/api";
import { sessionStore } from "../../stores/session";

type Mode = "login" | "register";

export function AuthPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryMode = searchParams.get("mode");
  const [mode, setMode] = useState<Mode>(queryMode === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    setMode(queryMode === "register" ? "register" : "login");
  }, [queryMode]);

  const mutation = useMutation({
    mutationFn: async () => {
      return mode === "login" ? login({ email, password }) : register({ email, password });
    },
    onSuccess(data) {
      sessionStore.setSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });
      navigate("/", { replace: true });
    },
  });

  return (
    <main className="auth-layout">
      <section className="auth-card">
        <aside className="auth-showcase">
          <p className="eyebrow">Modern document editing</p>
          <h1>Write like Notion. Ship like BlockNote.</h1>
          <p className="copy">
            Block-based workflows, slash commands, floating tools, and clean structure for focused writing.
          </p>
          <ul className="auth-feature-list">
            <li>Slash command insertion and block transforms</li>
            <li>Inline formatting toolbar and shortcuts</li>
            <li>Fast, clean workspace with document-first UI</li>
          </ul>
        </aside>

        <div className="auth-panel">
          <p className="eyebrow">Your workspace</p>
          <h2>{mode === "login" ? "Welcome back" : "Create account"}</h2>
          <p className="copy">Use your credentials to continue.</p>

          <div className="mode-switch">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setSearchParams({ mode: "login" });
              }}
              type="button"
            >
              Login
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setSearchParams({ mode: "register" });
              }}
              type="button"
            >
              Register
            </button>
          </div>

          <form
            className="auth-form"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <label>
              Email
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                minLength={8}
                required
              />
            </label>
            <button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? "Working..." : mode === "login" ? "Login" : "Create account"}
            </button>
            {mutation.error ? <p className="error-text">{mutation.error.message}</p> : null}
          </form>
        </div>
      </section>
    </main>
  );
}
