import { useState } from "react";

interface BrandLogoProps {
  compact?: boolean;
  variant?: "default" | "header";
}

export function BrandLogo({ compact = false, variant = "default" }: BrandLogoProps) {
  const [logoUnavailable, setLogoUnavailable] = useState(false);

  return (
    <div className={`brand-lockup ${compact ? "compact" : ""} ${variant === "header" ? "header" : ""}`}>
      {logoUnavailable ? (
        <span className="brand">BlockNote</span>
      ) : (
        <img
          src="/blocknote-logo.jpg"
          alt="BlockNote"
          className="brand-logo-image"
          onError={() => setLogoUnavailable(true)}
        />
      )}
    </div>
  );
}
