import { cn } from "@/lib/utils";

export function ResponsiveTableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0", className)}>
      <div className="min-w-[520px] sm:min-w-0">{children}</div>
    </div>
  );
}
