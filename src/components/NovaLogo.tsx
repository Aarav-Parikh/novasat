import rocket from "@/assets/nova-rocket.png";

interface Props {
  size?: number;
  className?: string;
  glow?: boolean;
}

/** NovaSAT mark — always the rocket ship, never a bare letter. */
export function NovaLogo({ size = 36, className = "", glow = false }: Props) {
  return (
    <div
      style={{ height: size, width: size }}
      className={`shrink-0 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center ${
        glow ? "shadow-[var(--glow-purple)]" : ""
      } ${className}`}
    >
      <img
        src={rocket}
        alt="NovaSAT logo"
        style={{ height: size * 0.62, width: size * 0.62 }}
        className="object-contain"
      />
    </div>
  );
}
