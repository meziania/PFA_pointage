import { cn } from "@/lib/utils";

export function NavBadge({
  count,
  active = false,
  className,
}: {
  count: number;
  active?: boolean;
  className?: string;
}) {
  if (count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={cn(
        "ml-auto inline-flex min-h-[1.125rem] min-w-[1.125rem] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums leading-none",
        active ? "bg-white/25 text-white" : "bg-status-pending-bg text-status-pending-text",
        className,
      )}
      aria-label={`${label} en attente`}
    >
      {label}
    </span>
  );
}
