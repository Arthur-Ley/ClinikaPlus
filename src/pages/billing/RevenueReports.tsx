import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  BarChartHorizontal,
  CalendarRange,
  CircleDollarSign,
  Coins,
  HandCoins,
  LoaderCircle,
  PieChart,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';

type FilterPreset = 'today' | 'this_week' | 'this_month' | 'custom';

type RevenueCard = {
  title: string;
  value: string;
  detail: string;
  chipClass: string;
  chipIconClass: string;
  valueClass: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  trend: number;
};

type ChartPoint = {
  label: string;
  value: number;
  raw_label?: string;
};

type BillingAnalytics = {
  total_pending_bills: number;
  total_paid_bills: number;
  total_transactions?: number;
  total_revenue: number;
  total_outstanding_balance: number;
  average_bill_amount: number;
};

type BillingReportsOverviewResponse = {
  analytics?: BillingAnalytics;
  comparison_analytics?: BillingAnalytics;
  trends?: {
    total_revenue_pct?: number;
    total_transactions_pct?: number;
    total_outstanding_balance_pct?: number;
    average_bill_amount_pct?: number;
  };
  date_range?: {
    preset?: string;
    start_date?: string;
    end_date?: string;
    previous_start_date?: string;
    previous_end_date?: string;
    label?: string;
    granularity?: string;
  };
  charts?: {
    revenue_by_period?: ChartPoint[];
    revenue_by_date?: ChartPoint[];
    revenue_by_method?: ChartPoint[];
    revenue_by_service?: ChartPoint[];
  };
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

function formatMoney(value: number) {
  return `PHP ${Math.round(value).toLocaleString()}`;
}

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 100000 ? 0 : 1,
  }).format(value);
}

function formatPercentDelta(value: number) {
  const rounded = Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : 1);
  return `${value >= 0 ? '+' : '-'}${rounded}%`;
}

function formatDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayInputValue() {
  return toDateInputValue(new Date());
}

function getStartOfWeekInputValue() {
  const date = new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return toDateInputValue(date);
}

function getStartOfMonthInputValue() {
  const date = new Date();
  date.setDate(1);
  return toDateInputValue(date);
}

function buildRangeForPreset(preset: FilterPreset, customStart: string, customEnd: string) {
  if (preset === 'today') {
    const today = getTodayInputValue();
    return { startDate: today, endDate: today };
  }

  if (preset === 'this_week') {
    return { startDate: getStartOfWeekInputValue(), endDate: getTodayInputValue() };
  }

  if (preset === 'custom') {
    return { startDate: customStart, endDate: customEnd };
  }

  return { startDate: getStartOfMonthInputValue(), endDate: getTodayInputValue() };
}

function getTrendTone(value: number) {
  if (value > 0) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (value < 0) return 'text-rose-700 bg-rose-50 border-rose-200';
  return 'text-slate-600 bg-slate-100 border-slate-200';
}

function getTrendIcon(value: number) {
  return value < 0 ? TrendingDown : TrendingUp;
}

function truncateLabel(value: string, max = 18) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 3))}...`;
}

function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

function ChartStat({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'sky' | 'amber' | 'emerald' | 'violet';
}) {
  const toneClass =
    tone === 'sky'
      ? 'border-sky-100 bg-sky-50 text-sky-900'
      : tone === 'amber'
        ? 'border-amber-100 bg-amber-50 text-amber-900'
        : tone === 'emerald'
          ? 'border-emerald-100 bg-emerald-50 text-emerald-900'
          : tone === 'violet'
            ? 'border-violet-100 bg-violet-50 text-violet-900'
            : 'border-slate-200 bg-slate-50 text-slate-900';

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </div>
  );
}

function DateFilterBar({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
  isRefreshing,
  rangeLabel,
  validationMessage,
}: {
  preset: FilterPreset;
  onPresetChange: (preset: FilterPreset) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (value: string) => void;
  onCustomEndChange: (value: string) => void;
  isRefreshing: boolean;
  rangeLabel: string;
  validationMessage: string;
}) {
  const presets: Array<{ key: FilterPreset; label: string }> = [
    { key: 'today', label: 'Today' },
    { key: 'this_week', label: 'This Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'custom', label: 'Custom Date Range' },
  ];

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white/90 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
            <CalendarRange className="h-4 w-4" />
            Global Date Filter
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-900">Reports Overview</p>
          <p className="mt-1 text-sm text-slate-500">{rangeLabel}</p>
        </div>

        <div className="flex flex-col gap-3 xl:items-end">
          <div className="flex flex-wrap gap-2">
            {presets.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => onPresetChange(option.key)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  preset === option.key
                    ? 'border-sky-500 bg-sky-500 text-white shadow-[0_12px_24px_rgba(14,165,233,0.28)]'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Start date
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => onCustomStartChange(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                End date
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => onCustomEndChange(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm">
            {isRefreshing && (
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-sky-700">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Updating data
              </span>
            )}
            {validationMessage && <span className="text-rose-600">{validationMessage}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({ card, isRefreshing }: { card: RevenueCard; isRefreshing: boolean }) {
  const Icon = card.icon;
  const TrendIcon = getTrendIcon(card.trend);

  return (
    <article
      className={`rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition duration-300 ${isRefreshing ? 'opacity-70' : 'opacity-100'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">{card.title}</p>
          <p className={`mt-4 text-3xl font-bold ${card.valueClass}`}>{card.value}</p>
          <p className="mt-2 text-sm text-slate-500">{card.detail}</p>
        </div>
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${card.chipClass}`}>
          <Icon size={18} className={card.chipIconClass} />
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${getTrendTone(card.trend)}`}>
          <TrendIcon className="h-4 w-4" />
          {formatPercentDelta(card.trend)}
        </span>
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">vs previous period</span>
      </div>
    </article>
  );
}

function ChartShell({
  icon: Icon,
  title,
  subtitle,
  headerContent,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  headerContent?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
          <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
      {headerContent ? <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">{headerContent}</div> : null}
      {children}
    </section>
  );
}

function RevenueOverTimeChart({ data, granularity }: { data: ChartPoint[]; granularity: string }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const title = granularity === 'month' ? 'Revenue by Month' : granularity === 'week' ? 'Revenue by Week' : 'Revenue by Day';
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const peak = data.reduce<ChartPoint | null>((best, item) => (!best || item.value > best.value ? item : best), null);
  const average = data.length ? total / data.length : 0;

  return (
    <ChartShell
      icon={BarChart3}
      title={title}
      subtitle="The selected date range drives every bar, so this view stays aligned with the cards above."
      headerContent={
        <>
          <ChartStat label="Periods" value={String(data.length)} />
          <ChartStat label="Peak" value={peak ? formatCompactMoney(peak.value) : 'PHP 0'} tone="sky" />
          <ChartStat label="Average" value={formatCompactMoney(average)} tone="emerald" />
        </>
      }
    >
      {data.length === 0 ? (
        <EmptyChartState message="No revenue points were found for this date range." />
      ) : (
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[560px] rounded-[26px] bg-[linear-gradient(180deg,rgba(14,165,233,0.08),rgba(255,255,255,0.94))] p-4">
            <div className="relative flex items-end gap-3">
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-slate-300"
                style={{ bottom: `${Math.max(24, (average / max) * 220) + 16}px` }}
              />
              <div className="pointer-events-none absolute right-0 top-0 rounded-full bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
                Avg {formatCompactMoney(average)}
              </div>
              {data.map((item) => {
                const height = Math.max(24, (item.value / max) * 220);
                const isPeak = peak?.label === item.label && peak?.value === item.value;
                return (
                  <div key={`${item.raw_label || item.label}-${item.value}`} className="group flex min-w-[64px] flex-1 flex-col items-center gap-2">
                    <div className="relative flex h-[240px] w-full items-end justify-center overflow-visible">
                      <div className="pointer-events-none absolute bottom-[calc(100%+12px)] z-20 w-48 rounded-2xl border border-slate-200 bg-slate-950 px-3 py-2 text-left text-xs text-white opacity-0 shadow-2xl transition duration-200 group-hover:opacity-100">
                        <div className="font-semibold">{item.raw_label || item.label}</div>
                        <div className="mt-1 text-slate-300">Revenue: {formatMoney(item.value)}</div>
                        <div className="mt-1 text-slate-400">{average > 0 ? `${((item.value / average) * 100).toFixed(0)}% of average` : 'No average yet'}</div>
                      </div>
                      <div
                        className={`w-full rounded-t-[22px] ${
                          isPeak
                            ? 'bg-[linear-gradient(180deg,#0ea5e9_0%,#1d4ed8_100%)] shadow-[0_18px_30px_rgba(14,165,233,0.35)]'
                            : 'bg-[linear-gradient(180deg,#38bdf8_0%,#0f766e_100%)] shadow-[0_18px_30px_rgba(14,165,233,0.25)]'
                        } transition-[height,transform] duration-500 group-hover:-translate-y-1`}
                        style={{ height: `${height}px` }}
                      />
                    </div>
                    <p className="text-center text-xs font-semibold text-slate-700">{item.label}</p>
                    <p className="text-xs text-slate-400">{formatCompactMoney(item.value)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </ChartShell>
  );
}

function PaymentMethodChart({ data }: { data: ChartPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const palette = ['from-sky-400 to-sky-600', 'from-emerald-400 to-emerald-600', 'from-amber-400 to-orange-500', 'from-fuchsia-400 to-violet-600', 'from-slate-400 to-slate-600'];
  const topMethod = data[0];
  const visibleData = data.filter((item) => item.value > 0);

  if (visibleData.length <= 1) return null;

  return (
    <ChartShell
      icon={PieChart}
      title="Payment Method Distribution"
      subtitle="Hover over each segment or legend row for a clearer breakdown of the selected range."
      headerContent={
        <>
          <ChartStat label="Methods" value={String(data.length)} />
          <ChartStat
            label="Top Method"
            value={topMethod ? truncateLabel(topMethod.label, 14) : 'N/A'}
            tone="emerald"
          />
          <ChartStat label="Revenue Covered" value={formatMoney(total)} tone="sky" />
        </>
      }
    >
      {visibleData.length === 0 ? (
        <EmptyChartState message="No payment methods are available because there are no transactions in this range." />
      ) : (
        <div className="space-y-5 rounded-[26px] bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.98))] p-4">
          <div className="space-y-3">
            {visibleData.map((item, index) => {
              const width = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div
                  key={`${item.label}-legend`}
                  className="group rounded-2xl border border-transparent bg-white/80 px-3 py-3 transition hover:border-slate-200 hover:bg-white"
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`h-3.5 w-3.5 rounded-full bg-gradient-to-r ${palette[index % palette.length]}`} />
                      <div>
                        <p className="font-semibold text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-500">{total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'}% of filtered revenue</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">{formatMoney(item.value)}</p>
                  </div>
                  <div className="relative h-3 overflow-visible rounded-full bg-slate-100">
                    <div className="pointer-events-none absolute bottom-[calc(100%+10px)] right-0 z-20 w-44 rounded-2xl border border-slate-200 bg-slate-950 px-3 py-2 text-xs text-white opacity-0 shadow-2xl transition duration-200 group-hover:opacity-100">
                      <div className="font-semibold">{item.label}</div>
                      <div className="mt-1 text-slate-300">{formatMoney(item.value)}</div>
                      <div className="mt-1 text-slate-400">{total > 0 ? `${((item.value / total) * 100).toFixed(1)}% share` : '0.0% share'}</div>
                    </div>
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${palette[index % palette.length]} transition-transform duration-200 group-hover:scale-y-110`}
                      style={{ width: `${Math.max(width, width > 0 ? 10 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ChartShell>
  );
}

function RevenueByServiceChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const topService = data[0];

  return (
    <ChartShell
      icon={BarChartHorizontal}
      title="Revenue by Service"
      subtitle="This list focuses on the highest-contributing services tied to the current filtered activity."
      headerContent={
        <>
          <ChartStat label="Services" value={String(data.length)} />
          <ChartStat label="Top Service" value={topService ? truncateLabel(topService.label, 14) : 'N/A'} tone="violet" />
          <ChartStat label="Service Revenue" value={formatMoney(total)} tone="sky" />
        </>
      }
    >
      {data.length === 0 ? (
        <EmptyChartState message="No service-level revenue was found for the current date range." />
      ) : (
        <div className="space-y-3 rounded-[26px] bg-[linear-gradient(180deg,rgba(238,242,255,0.92),rgba(255,255,255,0.98))] p-4">
          <div className="rounded-2xl border border-indigo-100 bg-white/80 px-4 py-3 text-sm text-slate-600">
            {data.length < 3
              ? 'There are only a few billable service entries in this range, so the service breakdown is still forming.'
              : `${topService?.label || 'Top service'} currently leads with ${topService && total > 0 ? ((topService.value / total) * 100).toFixed(1) : '0.0'}% of service revenue.`}
          </div>
          {data.map((item, index) => (
            <div key={item.label} className="group rounded-2xl bg-white/80 p-3 transition hover:bg-white">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {index + 1}
                    </span>
                    <p className="truncate font-semibold text-slate-800">{item.label}</p>
                  </div>
                  <p className="text-xs text-slate-500">{((item.value / max) * 100).toFixed(0)}% of top service value</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-700">{formatMoney(item.value)}</p>
                  <p className="text-xs text-slate-400">{total > 0 ? `${((item.value / total) * 100).toFixed(1)}% share` : '0.0% share'}</p>
                </div>
              </div>
              <div className="relative h-3 overflow-visible rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${
                    index % 2 === 0 ? 'from-indigo-400 to-sky-500' : 'from-cyan-400 to-emerald-500'
                  } shadow-[0_12px_20px_rgba(59,130,246,0.18)] transition-[width] duration-500`}
                  style={{ width: `${Math.max(10, (item.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartShell>
  );
}

function RevenueReportsSkeleton() {
  return (
    <section className="space-y-5 rounded-2xl bg-gray-300/80 p-5 font-sans animate-pulse">
      <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
        <div className="h-36 rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]" />
      </div>
      <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-48 rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]" />
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-gray-100 p-4 md:p-5">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {[1, 2].map((item) => (
            <div key={item} className="h-[360px] rounded-[30px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]" />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function RevenueReports() {
  const [preset, setPreset] = useState<FilterPreset>('this_month');
  const [customStart, setCustomStart] = useState(getStartOfMonthInputValue());
  const [customEnd, setCustomEnd] = useState(getTodayInputValue());
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);
  const [comparisonAnalytics, setComparisonAnalytics] = useState<BillingAnalytics | null>(null);
  const [trends, setTrends] = useState({
    total_revenue_pct: 0,
    total_transactions_pct: 0,
    total_outstanding_balance_pct: 0,
    average_bill_amount_pct: 0,
  });
  const [rangeLabel, setRangeLabel] = useState('This month');
  const [granularity, setGranularity] = useState('day');
  const [charts, setCharts] = useState({
    revenue_by_period: [] as ChartPoint[],
    revenue_by_date: [] as ChartPoint[],
    revenue_by_method: [] as ChartPoint[],
    revenue_by_service: [] as ChartPoint[],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const selectedRange = useMemo(() => buildRangeForPreset(preset, customStart, customEnd), [preset, customStart, customEnd]);

  const validationMessage = useMemo(() => {
    if (preset !== 'custom') return '';
    if (!customStart || !customEnd) return 'Select both dates to load a custom range.';
    if (customStart > customEnd) return 'Start date must be on or before the end date.';
    return '';
  }, [preset, customEnd, customStart]);

  useEffect(() => {
    if (validationMessage) return;

    const controller = new AbortController();
    const hasExistingData = analytics !== null;

    async function loadReports() {
      setLoadError('');
      if (hasExistingData) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const params = new URLSearchParams({
          preset,
          start_date: selectedRange.startDate,
          end_date: selectedRange.endDate,
        });

        const response = await fetch(`${API_BASE_URL}/billing/reports/overview?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Failed to load billing reports.');

        const payload = (await response.json()) as BillingReportsOverviewResponse;
        setAnalytics(payload.analytics || null);
        setComparisonAnalytics(payload.comparison_analytics || null);
        setTrends({
          total_revenue_pct: payload.trends?.total_revenue_pct ?? 0,
          total_transactions_pct: payload.trends?.total_transactions_pct ?? 0,
          total_outstanding_balance_pct: payload.trends?.total_outstanding_balance_pct ?? 0,
          average_bill_amount_pct: payload.trends?.average_bill_amount_pct ?? 0,
        });
        setRangeLabel(payload.date_range?.label || `${formatDateLabel(selectedRange.startDate)} - ${formatDateLabel(selectedRange.endDate)}`);
        setGranularity(payload.date_range?.granularity || 'day');
        setCharts({
          revenue_by_period: payload.charts?.revenue_by_period || [],
          revenue_by_date: payload.charts?.revenue_by_date || [],
          revenue_by_method: payload.charts?.revenue_by_method || [],
          revenue_by_service: payload.charts?.revenue_by_service || [],
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load billing reports.');
        setAnalytics(null);
        setComparisonAnalytics(null);
        setCharts({
          revenue_by_period: [],
          revenue_by_date: [],
          revenue_by_method: [],
          revenue_by_service: [],
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    loadReports();

    return () => {
      controller.abort();
    };
  }, [preset, selectedRange.endDate, selectedRange.startDate, validationMessage]);

  const cards = useMemo<RevenueCard[]>(() => {
    const totalRevenue = analytics?.total_revenue ?? 0;
    const outstanding = analytics?.total_outstanding_balance ?? 0;
    const avgPayment = analytics?.average_bill_amount ?? 0;
    const totalTransactions =
      analytics?.total_transactions ?? (analytics?.total_paid_bills ?? 0) + (analytics?.total_pending_bills ?? 0);

    return [
      {
        title: 'Total Revenue',
        value: formatMoney(totalRevenue),
        detail: `${analytics?.total_paid_bills ?? 0} paid bills in range`,
        chipClass: 'bg-emerald-100',
        chipIconClass: 'text-emerald-700',
        valueClass: 'text-slate-900',
        icon: CircleDollarSign,
        trend: trends.total_revenue_pct,
      },
      {
        title: 'Total Transactions',
        value: String(totalTransactions),
        detail: `${comparisonAnalytics?.total_transactions ?? 0} in the previous period`,
        chipClass: 'bg-sky-100',
        chipIconClass: 'text-sky-700',
        valueClass: 'text-slate-900',
        icon: ArrowLeftRight,
        trend: trends.total_transactions_pct,
      },
      {
        title: 'Outstanding Balance',
        value: formatMoney(outstanding),
        detail: `${analytics?.total_pending_bills ?? 0} pending bills in range`,
        chipClass: 'bg-amber-100',
        chipIconClass: 'text-amber-700',
        valueClass: 'text-slate-900',
        icon: HandCoins,
        trend: trends.total_outstanding_balance_pct,
      },
      {
        title: 'Average Payment',
        value: formatMoney(avgPayment),
        detail: 'Average transaction value for the selected range',
        chipClass: 'bg-violet-100',
        chipIconClass: 'text-violet-700',
        valueClass: 'text-slate-900',
        icon: Coins,
        trend: trends.average_bill_amount_pct,
      },
    ];
  }, [analytics, comparisonAnalytics?.total_transactions, trends]);

  const hasAnyData = useMemo(() => {
    if (analytics && (analytics.total_revenue > 0 || (analytics.total_transactions ?? 0) > 0)) return true;
    return Object.values(charts).some((series) => series.length > 0);
  }, [analytics, charts]);

  return (
    <div className="space-y-5 font-sans">
      {isLoading ? (
        <RevenueReportsSkeleton />
      ) : (
        <section className="space-y-5 rounded-2xl bg-gray-300/80 p-5">
          <DateFilterBar
            preset={preset}
            onPresetChange={setPreset}
            customStart={customStart}
            customEnd={customEnd}
            onCustomStartChange={setCustomStart}
            onCustomEndChange={setCustomEnd}
            isRefreshing={isRefreshing}
            rangeLabel={rangeLabel}
            validationMessage={validationMessage}
          />

          {loadError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>}

          {!loadError && !hasAnyData && (
            <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
              <p className="text-lg font-semibold text-slate-800">No report data for this date range</p>
              <p className="mt-2 text-sm text-slate-500">Try a wider date range or switch from a custom filter to this month.</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <SummaryCard key={card.title} card={card} isRefreshing={isRefreshing} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <RevenueOverTimeChart data={charts.revenue_by_period} granularity={granularity} />
            <RevenueByServiceChart data={charts.revenue_by_service} />
          </div>

          <PaymentMethodChart data={charts.revenue_by_method} />
        </section>
      )}
    </div>
  );
}
