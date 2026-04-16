import logoUrl from "../assets-blocknote-logo.jpg";

interface BrandLogoProps {
  compact?: boolean;
  variant?: "default" | "header";
}

export function BrandLogo({ compact = false, variant = "default" }: BrandLogoProps) {
  return (
    <div className={`brand-lockup ${compact ? "compact" : ""} ${variant === "header" ? "header" : ""}`}>
      <img src={logoUrl} alt="BlockNote" className="brand-logo-image" />
    </div>
  );
}
