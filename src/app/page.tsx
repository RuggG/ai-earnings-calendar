import { supabase } from "@/lib/supabase";

type EarningsRow = {
  id: number;
  isin: string;
  date: string;
  source: string | null;
  created_at: string;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(new Date(date));
}

async function loadUpcomingEarnings() {
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("earnings_calendar")
    .select("id, isin, date, source, created_at")
    .gte("date", todayIso)
    .order("date", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Failed to load earnings calendar", error.message);
    return [] satisfies EarningsRow[];
  }

  return (data ?? []) as EarningsRow[];
}

export default async function Home() {
  const rows = await loadUpcomingEarnings();
  const upcomingCount = rows.filter((row) => row.date === new Date().toISOString().slice(0, 10)).length;
  const sources = Array.from(new Set(rows.map((row) => row.source ?? "Unknown")));

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">AI Earnings Calendar</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Live view of upcoming earnings events synced from the librarian.earnings_calendar table in Supabase.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm text-slate-200 sm:text-right">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Total upcoming</p>
              <p className="text-2xl font-semibold">{rows.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Reporting today</p>
              <p className="text-2xl font-semibold">{upcomingCount}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-400">Sources</p>
              <p className="text-sm font-medium text-slate-100">{sources.join(", ") || "—"}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-xl shadow-slate-900/50">
          <div className="grid grid-cols-[0.6fr,1.4fr,0.8fr,1fr] border-b border-white/5 bg-slate-900/60 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Date</span>
            <span>ISIN</span>
            <span>Source</span>
            <span>Inserted</span>
          </div>
          <div className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                No upcoming earnings found.
              </div>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[0.6fr,1.4fr,0.8fr,1fr] px-6 py-4 text-sm text-slate-200 hover:bg-slate-800/60"
                >
                  <span className="font-medium">{formatDate(row.date)}</span>
                  <span className="font-mono text-slate-100">{row.isin}</span>
                  <span>{row.source ?? "Unknown"}</span>
                  <span className="text-slate-400">{formatDateTime(row.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <p className="mt-6 text-xs text-slate-500">
          Showing up to 500 upcoming entries ordered by reporting date.
        </p>
      </main>
    </div>
  );
}
