import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { CalendarView } from "@/components/calendar/calendar-view";
import { ConnectCalendarDialog } from "@/components/calendar/connect-calendar-dialog";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/page-loading";
import { Button } from "@/components/ui/button";
import { useData } from "@/lib/data";
import { addDays, formatDay, localDate, startOfWeek } from "@/lib/dates";
import { downloadText } from "@/lib/download";
import { buildCalendar } from "@/lib/ics";
import { listCalendarEvents, listIcsEvents } from "@/services/calendar";

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** Tous les entretiens et dates limites, à importer dans Outlook / Google / Apple Calendrier. */
async function exportCalendar() {
  const events = await listIcsEvents(window.location.origin);
  downloadText("stage-tracker.ics", buildCalendar(events, { name: "Stage Tracker" }), "text/calendar;charset=utf-8");
}

export function CalendarPage() {
  const mois = useSearchParams()[0].get("mois");
  const today = localDate();
  const month = mois && /^\d{4}-\d{2}$/.test(mois) ? mois : today.slice(0, 7);
  const monthEnd = addDays(`${shiftMonth(month, 1)}-01`, -1);
  const gridStart = startOfWeek(`${month}-01`);
  const gridEnd = addDays(startOfWeek(monthEnd), 6);
  const { data: events, error } = useData(() => listCalendarEvents(gridStart, gridEnd), [gridStart, gridEnd]);

  return (
    <div className="mx-auto max-w-7xl">
      <title>Calendrier · Stage Tracker</title>
      <PageHeader
        title={<span className="capitalize">{formatDay(`${month}-01`, "MMMM yyyy")}</span>}
        description="Entretiens, dates limites et tâches"
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" asChild>
                <Link to={`/calendrier?mois=${shiftMonth(month, -1)}`} aria-label="Mois précédent">
                  <ChevronLeft />
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link to="/calendrier">Aujourd&apos;hui</Link>
              </Button>
              <Button variant="outline" size="icon-sm" asChild>
                <Link to={`/calendrier?mois=${shiftMonth(month, 1)}`} aria-label="Mois suivant">
                  <ChevronRight />
                </Link>
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={exportCalendar} title="Télécharger tous les entretiens et dates limites (.ics)">
              <Download /> .ics
            </Button>
            <ConnectCalendarDialog />
          </>
        }
      />
      {events ? (
        <CalendarView month={month} today={today} gridStart={gridStart} gridEnd={gridEnd} events={events} />
      ) : (
        <PageLoading error={error} />
      )}
    </div>
  );
}
