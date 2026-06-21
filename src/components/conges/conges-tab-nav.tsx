"use client";

import { cn } from "@/lib/utils";

export type CongesTab = {
  id: string;
  label: string;
};

type Props = {
  tabs: CongesTab[];
  active: string;
  onChange: (id: string) => void;
};

export function CongesTabNav({ tabs, active, onChange }: Props) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-1 rounded-lg border bg-muted/40 p-1 sm:min-w-0 sm:flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "touch-target shrink-0 rounded-md px-4 py-2 text-sm font-medium transition-colors sm:shrink",
              active === t.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
