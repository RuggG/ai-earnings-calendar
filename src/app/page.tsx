import { supabase } from "@/lib/supabase";

type EarningsRow = {
  id: number;
  isin: string;
  date: string;
  source: string | null;
  created_at: string;
};

type CompanyRow = {
  isin: string;
  friendly_name: string | null;
  name: string | null;
  gics_sector: string | null;
  gics_industry: string | null;
  market_cap_millions_usd: number | null;
  country: string | null;
  ticker: string | null;
};

type ReportRow = {
  isin: string;
  storage_url: string | null;
  generated_at: string | null;
};

type CalendarRow = EarningsRow & {
  company?: CompanyRow;
  report?: ReportRow;
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

function formatMarketCap(marketCapMillions: number | null) {
  if (marketCapMillions === null || Number.isNaN(marketCapMillions)) {
    return "—";
  }

  const dollars = marketCapMillions * 1_000_000;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(dollars);
}

function formatCompany(row: CalendarRow) {
  const friendly = row.company?.friendly_name;
  const fallback = row.company?.name;
  return friendly || fallback || row.isin;
}

function formatTicker(row: CalendarRow) {
  const ticker = row.company?.ticker?.trim();
  const country = row.company?.country;
  const parts = [ticker, row.isin, country].filter((value) => Boolean(value && value !== ""));
  return parts.join(" • ");
}

async function loadUpcomingEarnings(): Promise<CalendarRow[]> {
  const todayIso = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .schema("librarian")
    .from("earnings_calendar")
    .select("id, isin, date, source, created_at")
    .gte("date", todayIso)
    .order("date", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Failed to load earnings calendar", error.message);
    return [];
  }

  const earningsRows = (data ?? []) as EarningsRow[];

  if (earningsRows.length === 0) {
    return [];
  }

  const isins = Array.from(new Set(earningsRows.map((row) => row.isin).filter(Boolean)));

  const [companiesResult, reportsResult] = await Promise.all([
    isins.length > 0
      ? supabase
          .schema("public")
          .from("company")
          .select("isin, friendly_name, name, gics_sector, gics_industry, market_cap_millions_usd, country, ticker")
          .in("isin", isins)
      : Promise.resolve({ data: [] as CompanyRow[], error: null }),
    isins.length > 0
      ? supabase
          .from("reports")
          .select("isin, storage_url, generated_at")
          .eq("report_type_id", 6)
          .in("isin", isins)
      : Promise.resolve({ data: [] as ReportRow[], error: null }),
  ]);

  if (companiesResult.error) {
    console.error("Failed to load company metadata", companiesResult.error.message);
  }

  if (reportsResult.error) {
    console.error("Failed to load report metadata", reportsResult.error.message);
  }

  const companies = ((companiesResult.data ?? []) as CompanyRow[]).reduce((map, company) => {
    map.set(company.isin, company);
    return map;
  }, new Map<string, CompanyRow>());

  const reports = ((reportsResult.data ?? []) as ReportRow[])
    .filter((report) => report.storage_url)
    .reduce((map, report) => {
      map.set(report.isin, report);
      return map;
    }, new Map<string, ReportRow>());

  return earningsRows.map((row) => ({
    ...row,
    company: companies.get(row.isin),
    report: reports.get(row.isin),
  }));
}

export default async function Home() {
  const rows = await loadUpcomingEarnings();
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingCount = rows.filter((row) => row.date === todayIso).length;
  const sources = Array.from(new Set(rows.map((row) => row.source ?? "Unknown")));

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100">
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">AI Earnings Calendar</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Live view of upcoming earnings events enriched with company fundamentals and preview reports (type 6).
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
          <div className="grid grid-cols-[0.7fr,1.6fr,1.2fr,0.9fr,0.8fr,0.9fr,1fr] border-b border-white/5 bg-slate-900/60 px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>Date</span>
            <span>Company</span>
            <span>Sector</span>
            <span>Market Cap</span>
            <span>Source</span>
            <span>Preview</span>
            <span>Inserted</span>
          </div>
          <div className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                No upcoming earnings found.
              </div>
            ) : (
              rows.map((row) => {
                const tickerLine = formatTicker(row);
                const previewUrl = row.report?.storage_url;

                return (
                  <div
                    key={row.id}
                    className="grid grid-cols-[0.7fr,1.6fr,1.2fr,0.9fr,0.8fr,0.9fr,1fr] px-6 py-4 text-sm text-slate-200 hover:bg-slate-800/60"
                  >
                    <span className="font-medium">{formatDate(row.date)}</span>
                    <span>
                      <span className="block font-semibold text-slate-100">{formatCompany(row)}</span>
                      <span className="mt-1 block text-xs font-mono uppercase tracking-wide text-slate-400">
                        {tickerLine || row.isin}
                      </span>
                    </span>
                    <span>
                      <span className="block font-medium text-slate-100">{row.company?.gics_sector ?? "—"}</span>
                      <span className="mt-1 block text-xs text-slate-400">{row.company?.gics_industry ?? ""}</span>
                    </span>
                    <span>{formatMarketCap(row.company?.market_cap_millions_usd ?? null)}</span>
                    <span>{row.source ?? "Unknown"}</span>
                    <span>
                      {previewUrl ? (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-sky-400 underline-offset-4 hover:text-sky-300 hover:underline"
                        >
                          View preview
                        </a>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="text-slate-400">{formatDateTime(row.created_at)}</span>
                  </div>
                );
              })
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
