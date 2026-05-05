import Image from "next/image";
import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  className?: string;
  variant?: "banner" | "icon";
  size?: "sm" | "md" | "lg";
  alt?: string;
};

export function BrandLogo({
  href = "/",
  className,
  variant = "banner",
  size = "md",
  alt = "ChronoSense",
}: BrandLogoProps) {
  const dims =
    variant === "icon"
      ? { width: 40, height: 40 }
      : size === "lg"
        ? { width: 320, height: 64 }
        : size === "sm"
          ? { width: 140, height: 28 }
          : { width: 200, height: 40 };

  return (
    <Link href={href} className="inline-flex items-center" aria-label={alt} title={alt}>
      <Image
        src="/logoLightMode.png"
        alt={alt}
        width={dims.width}
        height={dims.height}
        priority
        className={["dark:hidden", className].filter(Boolean).join(" ")}
        style={{ height: "auto" }}
      />
      <Image
        src="/logoDarkMode.png"
        alt={alt}
        width={dims.width}
        height={dims.height}
        priority
        className={["hidden dark:block", className].filter(Boolean).join(" ")}
        style={{ height: "auto" }}
      />
    </Link>
  );
}

