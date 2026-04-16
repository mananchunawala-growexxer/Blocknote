import React from "react";
import { BrandLogo } from "./BrandLogo";

interface WorkspaceHeaderProps {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}

export function WorkspaceHeader({ eyebrow, title, subtitle, actions }: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <div className="workspace-header-brand">
        <BrandLogo compact variant="header" />
      </div>
      <div className="workspace-header-copy">
        <p className="eyebrow">{eyebrow}</p>
        <div className="workspace-header-title">{title}</div>
        {subtitle ? <div className="workspace-header-subtitle copy">{subtitle}</div> : null}
      </div>
      {actions ? <div className="workspace-header-actions">{actions}</div> : null}
    </header>
  );
}
