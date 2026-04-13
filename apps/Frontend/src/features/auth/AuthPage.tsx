import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { login, register } from "../../lib/api";
import { sessionStore } from "../../stores/session";

type Mode = "login" | "register";

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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
        <p className="eyebrow">Day 1 delivery</p>
        <h1>BlockNote</h1>
        <p className="copy">Register or log in to manage your documents.</p>
        <div className="mode-switch">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")} type="button">
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")} type="button">
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
      </section>
    </main>
  );
}
