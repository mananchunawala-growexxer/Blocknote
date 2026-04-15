import logoUrl from "../assets-blocknote-logo.jpg";

interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <div className={`brand-lockup ${compact ? "compact" : ""}`}>
      <img src={logoUrl} alt="BlockNote" className="brand-logo-image" />
    </div>
  );
}
