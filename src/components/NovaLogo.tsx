import logo from "@/assets/novasat-logo.png.asset.json";

interface Props {
  size?: number;
  className?: string;
  glow?: boolean;
}

/** NovaSAT mark — always the high-resolution rocket mark, never a bare letter. */
export function NovaLogo({ size = 36, className = "", glow = false }: Props) {
  return (
    <div
      style={{ height: size, width: size }}
      className={`shrink-0 overflow-hidden rounded-xl flex items-center justify-center ${
        glow ? "shadow-[var(--glow-purple)]" : ""
      } ${className}`}
    >
      <img
        src={logo.url}
        alt="NovaSAT logo"
        width={1024}
        height={1024}
        style={{ height: size, width: size }}
        className="object-cover"
      />
    </div>
  );
}
