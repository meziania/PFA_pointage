import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  size?: number;
};

export function BrandMark({ className, size = 40 }: BrandMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id="ttp-mark-bg" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0f6e56" />
          <stop offset="1" stopColor="#04342c" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#ttp-mark-bg)" />
      <circle cx="24" cy="24" r="11" fill="none" stroke="#e1f5ee" strokeWidth="2" />
      <path
        d="M24 16v8l5.5 3.2"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="30" y="30" width="3" height="3" rx="0.6" fill="#e1f5ee" opacity="0.95" />
      <rect x="34" y="30" width="3" height="3" rx="0.6" fill="#e1f5ee" opacity="0.7" />
      <rect x="30" y="34" width="3" height="3" rx="0.6" fill="#e1f5ee" opacity="0.7" />
      <rect x="34" y="34" width="3" height="3" rx="0.6" fill="#e1f5ee" opacity="0.95" />
      <circle cx="37" cy="13" r="6" fill="#173404" />
      <path
        d="M34.2 13l2 2 3.6-4.2"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
