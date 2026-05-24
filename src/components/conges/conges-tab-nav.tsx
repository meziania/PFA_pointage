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
    <div className="flex flex-wrap gap-2 rounded-lg border bg-muted/40 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-colors",
            active === t.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
