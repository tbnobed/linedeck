import { useId } from "react";

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  onAir?: boolean;
  className?: string;
}

export function Logo({ size = 22, withWordmark = true, onAir = false, className = "" }: LogoProps) {
  const gradId = useId();
  const stroke = onAir ? "var(--ld-onair)" : "var(--ld-accent)";
  const nodeFrom = onAir ? "#FF7A7A" : "var(--ld-accent-bright)";
  const nodeTo = onAir ? "var(--ld-onair-deep)" : "var(--ld-accent-deep)";
  const glow = onAir ? "var(--ld-onair-glow)" : "var(--ld-accent-glow)";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 128 128"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: `drop-shadow(0 0 8px ${glow})` }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="40" y1="38" x2="92" y2="92" gradientUnits="userSpaceOnUse">
            <stop stopColor={nodeFrom} />
            <stop offset="1" stopColor={nodeTo} />
          </linearGradient>
        </defs>
        <path
          d="M64 26 a38 38 0 0 1 0 76"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.42"
        />
        <path
          d="M64 40 a24 24 0 0 1 0 48"
          stroke={stroke}
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.8"
        />
        <circle
          cx="64"
          cy="64"
          r="11"
          fill={`url(#${CSS.escape(gradId)})`}
          className={onAir ? "ld-pulse-node" : ""}
        />
      </svg>

      {withWordmark && (
        <span
          className="font-semibold tracking-tight leading-none"
          style={{ fontSize: Math.round(size * 0.75) }}
        >
          <span className="text-foreground">Line</span>
          <span style={{ color: "var(--ld-accent-bright)", fontWeight: 500 }}>Deck</span>
        </span>
      )}
    </div>
  );
}
