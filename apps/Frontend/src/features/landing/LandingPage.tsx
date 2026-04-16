import React from "react";
import { useNavigate } from "react-router-dom";
import { BrandLogo } from "../../components/BrandLogo";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const frameRef = React.useRef<HTMLElement>(null);

  const handleMouseMove = (event: React.MouseEvent<HTMLElement>) => {
    const frame = frameRef.current;
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width;
    const relativeY = (event.clientY - rect.top) / rect.height;

    frame.style.setProperty("--pointer-x", `${(relativeX - 0.5) * 2}`);
    frame.style.setProperty("--pointer-y", `${(relativeY - 0.5) * 2}`);
    frame.style.setProperty("--cursor-x", `${relativeX * 100}%`);
    frame.style.setProperty("--cursor-y", `${relativeY * 100}%`);
  };

  const handleMouseLeave = () => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.style.setProperty("--pointer-x", "0");
    frame.style.setProperty("--pointer-y", "0");
    frame.style.setProperty("--cursor-x", "50%");
    frame.style.setProperty("--cursor-y", "50%");
  };

  return (
    <main className="landing-shell">
      <section className="landing-frame" ref={frameRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <div className="landing-bg-media" aria-hidden>
          <img
            className="landing-bg-image landing-bg-image-left"
            src="https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1400&q=80"
            alt=""
          />
          <img
            className="landing-bg-image landing-bg-image-right"
            src="https://images.unsplash.com/photo-1484417894907-623942c8ee29?auto=format&fit=crop&w=1400&q=80"
            alt=""
          />
          <div className="landing-doc-card landing-doc-card-brief">
            <p>Meeting Notes.md</p>
            <span />
            <span />
            <span />
          </div>
          <div className="landing-doc-card landing-doc-card-plan">
            <p>Roadmap Draft</p>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="landing-bg-glow" />
        </div>

        <div className="landing-ambient" aria-hidden>
          <span>Notes</span>
          <span>Drafts</span>
          <span>Specs</span>
          <span>Docs</span>
          <span>Ideas</span>
        </div>

        <div className="landing-layout">
          <section className="landing-hero">
            <BrandLogo />
            <p className="eyebrow motion-rise motion-delay-1">Professional document editor</p>
            <h1 className="motion-rise motion-delay-2">
              Write faster.
              <br />
              Structure better.
              <br />
              Publish confidently.
            </h1>
            <p className="copy motion-rise motion-delay-3">
              A modern block-based editor inspired by the best writing tools, designed for polished notes, specs, and
              team docs.
            </p>

            <div className="landing-ctas motion-rise motion-delay-4">
              <button type="button" className="cta-primary" onClick={() => navigate("/auth?mode=register")}>
                Create Account
              </button>
              <button type="button" className="cta-secondary" onClick={() => navigate("/auth?mode=login")}>
                Sign In
              </button>
            </div>
          </section>

          <section className="landing-preview motion-rise motion-delay-3">
            <div className="preview-card preview-card-main">
              <div className="preview-toolbar">
                <span />
                <span />
                <span />
              </div>
              <p className="preview-label">Editor canvas</p>
              <h3>Product Spec Draft</h3>
              <ul>
                <li>Slash command blocks</li>
                <li>Inline formatting toolbar</li>
                <li>Markdown-style shortcuts</li>
              </ul>
              <div className="preview-lines" aria-hidden />
            </div>

            <div className="preview-card preview-card-floating">
              <p className="preview-label">Quick actions</p>
              <div className="preview-pills">
                <span>/ Heading</span>
                <span>/ To-do</span>
                <span>/ Code</span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
};
