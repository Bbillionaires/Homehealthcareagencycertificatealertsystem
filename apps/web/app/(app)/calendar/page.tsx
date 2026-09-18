import Link from "next/link";
import { requireOrgContext } from "@/lib/session";
import { getCalendarEvents, type CalendarEvent } from "@/lib/data/calendarEvents";
import { StatusBadge } from "@/components/StatusBadge";
import {
  addDays,
  addMonths,
  dayOfMonth,
  getMonthGrid,
  getWeekDays,
  isSameMonth,
  longLabel,
  monthLabel,
  todayIso,
  weekdayNames,
} from "@/lib/calendar/dateGrid";

type View = "month" | "week" | "day";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const ctx = await requireOrgContext();
  const params = await searchParams;
  const view: View = params.view === "week" || params.view === "day" ? params.view : "month";
  const anchor = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : todayIso();
  const today = todayIso();

  const events = await getCalendarEvents(ctx.userId, ctx.organizationId);
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = eventsByDate.get(event.date) ?? [];
    list.push(event);
    eventsByDate.set(event.date, list);
  }

  const { prevHref, nextHref, todayHref } = getNavHrefs(view, anchor);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Compliance Calendar</h1>
          <p className="text-sm text-slate-500">Upcoming and recent credential expirations across the active roster.</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewTab view={view} target="day" anchor={anchor} />
          <ViewTab view={view} target="week" anchor={anchor} />
          <ViewTab view={view} target="month" anchor={anchor} />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Link href={prevHref} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            ← Previous
          </Link>
          <Link href={todayHref} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            Today
          </Link>
          <Link href={nextHref} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            Next →
          </Link>
        </div>
        <p className="text-sm font-semibold text-slate-900">
          {view === "day" ? longLabel(anchor) : monthLabel(anchor)}
        </p>
      </div>

      {view === "month" && <MonthView anchor={anchor} today={today} eventsByDate={eventsByDate} />}
      {view === "week" && <WeekView anchor={anchor} today={today} eventsByDate={eventsByDate} />}
      {view === "day" && <DayView anchor={anchor} events={eventsByDate.get(anchor) ?? []} />}
    </div>
  );
}

function getNavHrefs(view: View, anchor: string) {
  const step = view === "month" ? { fn: addMonths, amount: 1 } : view === "week" ? { fn: addDays, amount: 7 } : { fn: addDays, amount: 1 };
  const prev = step.fn(anchor, -step.amount);
  const next = step.fn(anchor, step.amount);
  return {
    prevHref: `/calendar?view=${view}&date=${prev}`,
    nextHref: `/calendar?view=${view}&date=${next}`,
    todayHref: `/calendar?view=${view}&date=${todayIso()}`,
  };
}

function ViewTab({ view, target, anchor }: { view: View; target: View; anchor: string }) {
  const active = view === target;
  return (
    <Link
      href={`/calendar?view=${target}&date=${anchor}`}
      className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
        active ? "bg-brand-600 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {target}
    </Link>
  );
}

function EventPill({ event }: { event: CalendarEvent }) {
  return (
    <Link
      href={`/employees/${event.employeeId}`}
      className="block truncate rounded px-1.5 py-0.5 text-xs hover:underline"
      style={{ backgroundColor: PILL_BG[event.color], color: PILL_TEXT[event.color] }}
      title={`${event.employeeName} · ${event.credentialTypeName} · ${event.label}`}
    >
      {event.employeeName.split(" ")[0]}: {event.credentialTypeName}
    </Link>
  );
}

const PILL_BG: Record<CalendarEvent["color"], string> = {
  green: "#ecfdf3",
  yellow: "#fffaeb",
  orange: "#fff4ed",
  red: "#fef3f2",
  gray: "#f9fafb",
};
const PILL_TEXT: Record<CalendarEvent["color"], string> = {
  green: "#027a48",
  yellow: "#b54708",
  orange: "#c4320a",
  red: "#b42318",
  gray: "#414651",
};

function MonthView({
  anchor,
  today,
  eventsByDate,
}: {
  anchor: string;
  today: string;
  eventsByDate: Map<string, CalendarEvent[]>;
}) {
  const days = getMonthGrid(anchor);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
        {weekdayNames().map((name) => (
          <div key={name} className="px-3 py-2">
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const dayEvents = eventsByDate.get(date) ?? [];
          const inMonth = isSameMonth(date, anchor);
          return (
            <div
              key={date}
              className={`min-h-[110px] border-b border-r border-slate-100 p-2 ${inMonth ? "" : "bg-slate-50/50"}`}
            >
              <Link
                href={`/calendar?view=day&date=${date}`}
                className={`text-xs font-semibold hover:underline ${
                  date === today ? "rounded bg-brand-600 px-1.5 py-0.5 text-white" : inMonth ? "text-slate-700" : "text-slate-400"
                }`}
              >
                {dayOfMonth(date)}
              </Link>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((event, i) => (
                  <EventPill key={`${event.employeeId}-${event.credentialTypeId}-${i}`} event={event} />
                ))}
                {dayEvents.length > 3 && (
                  <Link href={`/calendar?view=day&date=${date}`} className="block text-xs text-slate-400 hover:underline">
                    +{dayEvents.length - 3} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  anchor,
  today,
  eventsByDate,
}: {
  anchor: string;
  today: string;
  eventsByDate: Map<string, CalendarEvent[]>;
}) {
  const days = getWeekDays(anchor);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
      {days.map((date) => {
        const dayEvents = eventsByDate.get(date) ?? [];
        return (
          <div key={date} className={`rounded-xl border bg-white p-3 ${date === today ? "border-brand-500" : "border-slate-200"}`}>
            <Link href={`/calendar?view=day&date=${date}`} className="text-xs font-semibold text-slate-700 hover:underline">
              {longLabel(date)}
            </Link>
            <div className="mt-2 space-y-1">
              {dayEvents.length === 0 ? (
                <p className="text-xs text-slate-400">No expirations</p>
              ) : (
                dayEvents.map((event, i) => <EventPill key={`${event.employeeId}-${event.credentialTypeId}-${i}`} event={event} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ anchor, events }: { anchor: string; events: CalendarEvent[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{longLabel(anchor)}</h2>
      </div>
      {events.length === 0 ? (
        <p className="p-5 text-sm text-slate-500">No credentials expire on this day.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {events.map((event, i) => (
            <li key={`${event.employeeId}-${event.credentialTypeId}-${i}`} className="flex items-center justify-between px-5 py-3">
              <div>
                <Link href={`/employees/${event.employeeId}`} className="text-sm font-medium text-slate-900 hover:underline">
                  {event.employeeName}
                </Link>
                <p className="text-xs text-slate-500">{event.credentialTypeName}</p>
              </div>
              <StatusBadge color={event.color} icon={event.icon} label={event.label} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
