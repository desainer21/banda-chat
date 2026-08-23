"use client";

type BandaLogoProps = {
  size?: number;
  className?: string;
};

export default function BandaLogo({
  size = 80,
  className = "",
}: BandaLogoProps) {
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
      }}
      aria-label="Logo Banda Chat"
      role="img"
    >
      <svg
        viewBox="0 0 80 80"
        width={size}
        height={size}
        className="block"
      >
        <path
          d="
            M20 8
            H60
            C70 8 76 14 76 24
            V48
            C76 58 70 64 60 64
            H37
            L23 76
            L26 64
            H20
            C10 64 4 58 4 48
            V24
            C4 14 10 8 20 8
            Z
          "
          fill="#00C853"
        />

        <text
          x="40"
          y="47"
          textAnchor="middle"
          fontSize="32"
          fontWeight="700"
          fontFamily="Arial, Helvetica, sans-serif"
          fill="white"
        >
          B
        </text>
      </svg>
    </div>
  );
}