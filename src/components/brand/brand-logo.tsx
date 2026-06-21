import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand/brand-mark";

type BrandLogoProps = {
  href?: string;
  className?: string;
  variant?: "banner" | "icon";
  size?: "sm" | "md" | "lg";
  alt?: string;
};

const markSize = { sm: 28, md: 36, lg: 44 } as const;
const textSize = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl",
} as const;

export function BrandLogo({
  href = "/",
  className,
  variant = "banner",
  size = "md",
  alt = "TimeTrack Pro",
}: BrandLogoProps) {
  const content =
    variant === "icon" ? (
      <BrandMark size={markSize[size]} />
    ) : (
      <span className={cn("inline-flex items-center gap-2.5", variant === "banner" ? className : undefined)}>
        <BrandMark size={markSize[size]} />
        <span className={cn("font-heading leading-none tracking-tight text-brand-dark", textSize[size])}>
          TimeTrack<span className="text-brand"> Pro</span>
        </span>
      </span>
    );

  return (
    <Link href={href} className={cn("inline-flex items-center", className)} aria-label={alt} title={alt}>
      {content}
    </Link>
  );
}
