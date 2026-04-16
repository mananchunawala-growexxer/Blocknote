import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BrandLogo } from "../../components/BrandLogo";
import { login, register } from "../../lib/api";
import { sessionStore } from "../../stores/session";

type Mode = "login" | "register";

export function AuthPage() {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryMode = searchParams.get("mode");
  const [mode, setMode] = useState<Mode>(queryMode === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    setMode(queryMode === "register" ? "register" : "login");
  }, [queryMode]);

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width;
    const relativeY = (event.clientY - rect.top) / rect.height;

    card.style.setProperty("--pointer-x", `${(relativeX - 0.5) * 2}`);
    card.style.setProperty("--pointer-y", `${(relativeY - 0.5) * 2}`);
    card.style.setProperty("--cursor-x", `${relativeX * 100}%`);
    card.style.setProperty("--cursor-y", `${relativeY * 100}%`);
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--pointer-x", "0");
    card.style.setProperty("--pointer-y", "0");
    card.style.setProperty("--cursor-x", "50%");
    card.style.setProperty("--cursor-y", "50%");
  };

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
      <section className="auth-card" ref={cardRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <div className="auth-bg-media" aria-hidden>
          <img
            className="auth-bg-image auth-bg-image-left"
            src="https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1400&q=80"
            alt=""
          />
          <img
            className="auth-bg-image auth-bg-image-right"
            src="https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?auto=format&fit=crop&w=1400&q=80"
            alt=""
          />
          <div className="auth-doc-card auth-doc-card-brief">
            <p>Editorial Checklist</p>
            <span />
            <span />
            <span />
          </div>
          <div className="auth-doc-card auth-doc-card-plan">
            <p>Sprint Notes</p>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="auth-bg-glow" />
        </div>

        <div className="auth-ambient" aria-hidden>
          <span>Workspace</span>
          <span>Drafts</span>
          <span>Docs</span>
          <span>Blocks</span>
          <span>Ideas</span>
        </div>

        <aside className="auth-showcase">
          <BrandLogo />
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

          <div className="auth-nav-links">
            <button className="secondary" type="button" onClick={() => navigate("/")}>
              ← Back to Home
            </button>
          </div>

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
