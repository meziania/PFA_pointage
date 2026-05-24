"use client";

import { useMemo, useState } from "react";
import { addMonths, format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  buildCalendarDays,
  eventKindClass,
  eventKindLabel,
  formatMonthYear,
  primaryEventKind,
  type CalendarDay,
  type CalendarEventKind,
  type CongeCalendarRow,
} from "@/lib/calendar-utils";
import { getMoroccoHolidaysInRange } from "@/lib/morocco-holidays";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const LEGEND: CalendarEventKind[] = ["ferie", "annuel", "maladie", "exceptionnel", "en_attente"];

type Props = {
  title?: string;
  description?: string;
  conges: CongeCalendarRow[];
  loading?: boolean;
  showAllEmployees?: boolean;
  includePending?: boolean;
};

export function AbsenceCalendar({
  title = "Calendrier des absences",
  description = "Jours fériés, congés et maladies sur le mois affiché.",
  conges,
  loading = false,
  showAllEmployees = false,
  includePending = true,
}: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<CalendarDay | null>(null);

  const range = useMemo(() => {
    const start = format(startOfMonth(month), "yyyy-MM-dd");
    const end = format(endOfMonth(month), "yyyy-MM-dd");
    return { start, end };
  }, [month]);

  const holidays = useMemo(
    () => getMoroccoHolidaysInRange(range.start, range.end),
    [range.start, range.end],
  );

  const days = useMemo(
    () =>
      buildCalendarDays(month, conges, holidays, {
        includePending,
        onlyValidated: false,
      }),
    [month, conges, holidays, includePending],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Mois précédent">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[10rem] text-center text-sm font-semibold capitalize">{formatMonthYear(month)}</span>
            <Button type="button" variant="outline" size="icon" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Mois suivant">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
              Aujourd&apos;hui
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Chargement du calendrier…</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2">
                {LEGEND.map((kind) => (
                  <span key={kind} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", eventKindClass(kind))}>
                    {eventKindLabel(kind)}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-2">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {days.map((day) => {
                  const hasEvents = day.events.length > 0;
                  const primaryKind = primaryEventKind(day.events);
                  const isToday = day.date === format(new Date(), "yyyy-MM-dd");

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelected(day)}
                      className={cn(
                        "relative flex min-h-[4.25rem] flex-col rounded-lg border p-1 text-left transition-colors hover:bg-muted/60",
                        !day.isCurrentMonth && "opacity-40",
                        day.isWeekend && day.isCurrentMonth && "bg-muted/30",
                        isToday && "ring-2 ring-primary/50",
                        hasEvents && primaryKind && eventKindClass(primaryKind),
                      )}
                    >
                      <span className="text-xs font-semibold tabular-nums">{day.dayOfMonth}</span>
                      {hasEvents ? (
                        <div className="mt-0.5 flex flex-col gap-0.5 overflow-hidden">
                          {day.events.slice(0, showAllEmployees ? 2 : 3).map((ev, i) => (
                            <span key={`${day.date}-${i}`} className="truncate text-[10px] leading-tight font-medium">
                              {ev.kind === "ferie" ? ev.label : ev.label.split(" — ")[0]}
                            </span>
                          ))}
                          {day.events.length > (showAllEmployees ? 2 : 3) ? (
                            <span className="text-[10px] opacity-80">+{day.events.length - (showAllEmployees ? 2 : 3)}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {format(new Date(selected.date + "T12:00:00"), "EEEE d MMMM yyyy", { locale: fr })}
            </CardTitle>
            <CardDescription>
              {selected.events.length === 0 ? "Aucune absence ni jour férié." : `${selected.events.length} événement(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {selected.events.length === 0 ? (
                <li className="text-sm text-muted-foreground">Journée normale (hors week-end).</li>
              ) : (
                selected.events.map((ev, i) => (
                  <li key={i} className={cn("rounded-md border px-3 py-2 text-sm", eventKindClass(ev.kind))}>
                    <span className="font-medium">{eventKindLabel(ev.kind)}</span>
                    {ev.label ? <span className="mt-0.5 block text-xs opacity-90">{ev.label}</span> : null}
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
