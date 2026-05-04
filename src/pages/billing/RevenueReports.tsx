import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownRight, ArrowUpRight, CalendarRange, ChevronLeft, ChevronRight, Layers, ShieldCheck, Percent, TrendingUp, X } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { SkeletonBlock } from './BillingSkeletonParts';

type Category = 'medication' | 'billing' | 'payment';
type Preset = 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom';
type Bucket = 'day' | 'week' | 'month';

type SummaryResponse = {
  insights?: {
    stockout_alerts_next_7_days?: number;
    demand_spikes_wow?: number;
    expiry_value_at_risk?: number;
    top_medication_by_revenue?: { medication_name: string; revenue: number } | null;
  };
};

type DemandTrendResponse = {
  series?: Array<{
    medication_name: string;
    points: Array<{ label: string; value: number }>;
  }>;
};

type TopMoversResponse = {
  rising?: Array<{ medication_name: string; current_quantity: number }>;
  falling?: Array<{ medication_name: string; current_quantity: number }>;
};

type ExpiryRiskResponse = {
  metrics?: {
    near_expiry_quantity?: number;
    disposed_quantity?: number;
    at_risk_value?: number;
  };
  trend?: Array<{ label: string; near_expiry_quantity: number; disposed_quantity: number }>;
};

type RevenueMixResponse = {
  items?: Array<{ medication_name: string; revenue: number; share_pct: number }>;
};

type MedicationCatalogResponse = {
  items?: Array<{ medication_name?: string; category_name?: string }>;
};

type AnalyticsResponse = {
  analytics?: {
    total_pending_bills?: number;
    total_paid_bills?: number;
    total_transactions?: number;
    total_revenue?: number;
    total_outstanding_balance?: number;
    average_bill_amount?: number;
  };
};

type BillsResponse = { items?: Array<{ status?: string; net_amount?: number; total_amount?: number; bill_id?: number }> };
type PaymentsResponse = { items?: Array<{ amount_paid?: number; payment_method?: string; payment_date?: string }> };
type SystemMode = 'integrated' | 'standalone';
type BillingBillRow = { status?: string | null; created_at?: string | null; bill_date?: string | null; net_amount?: number | null };
type PaymentRow = {
  amount_paid?: number | null;
  payment_method?: string | null;
  payment_date?: string | null;
  created_at?: string | null;
};
type BillAmountRow = {
  status?: string | null;
  net_amount?: number | null;
  bill_date?: string | null;
  created_at?: string | null;
};

type KpiCard = {
  title: string;
  value: string;
  detail: string;
  trendPct: number;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const SYSTEM_MODE_STORAGE_KEY = 'clinikapluss_system_mode';

function getSavedSystemMode(): SystemMode {
  if (typeof window === 'undefined') return 'standalone';
  return window.localStorage.getItem(SYSTEM_MODE_STORAGE_KEY) === 'integrated' ? 'integrated' : 'standalone';
}

function normalizeBillStatusForDistribution(status: string | null | undefined) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'paid') return 'Paid';
  if (normalized === 'pending') return 'Pending';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
  return null;
}

function truncateByBucket(date: Date, bucket: Bucket) {
  if (bucket === 'month') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  if (bucket === 'week') {
    const monday = startOfWeek(date);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDateInput(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBetween(date: Date, start: Date, end: Date) {
  const t = date.getTime();
  return t > start.getTime() && t < end.getTime();
}

function startOfCalendarGrid(monthDate: Date) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const day = first.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return shiftDays(first, diff);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function addMonths(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function shiftDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return shiftDays(d, diff);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1);
}

function formatPeso(v: number) {
  return `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCount(v: number) {
  return Number(v || 0).toLocaleString('en-US');
}

const chartTextStyle = { fontSize: 12, fill: '#475569' };

function LeftAlignedYAxisTick({ y = 0, payload }: { y?: string | number; payload?: { value?: unknown } }) {
  const label = payload && typeof payload === 'object' && 'value' in payload ? String(payload.value ?? '') : '';
  const yPos = typeof y === 'number' ? y : Number(y) || 0;
  return (
    <text x={0} y={yPos + 6} fill="#334155" fontSize={12} textAnchor="start">
      {label}
    </text>
  );
}

function toMonthLabel(value: string | number) {
  const date = new Date(value);
  if (!isFinite(date.getTime())) return String(value || '');
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function toTimestamp(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  // Treat date-only strings as local calendar dates to avoid UTC day-shift issues.
  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    const parsedLocal = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (!isFinite(parsedLocal.getTime())) return null;
    return parsedLocal.getTime();
  }

  const parsed = new Date(raw);
  if (!isFinite(parsed.getTime())) return null;
  return parsed.getTime();
}

function toLocalIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function eachDayInclusive(start: Date, end: Date) {
  const dates: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const limit = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cursor.getTime() <= limit.getTime()) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function eachMonthInclusive(start: Date, end: Date) {
  const dates: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor.getTime() <= limit.getTime()) {
    dates.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates;
}

function parseTrendLabelDate(value: string, fallbackYear: number) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  const containsYear = /\b\d{4}\b/.test(trimmed) || /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/.test(trimmed);
  const parsedWithYear = new Date(trimmed);
  if (containsYear && isFinite(parsedWithYear.getTime())) return parsedWithYear;

  const monthDayMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (monthDayMatch) {
    const [, month, day] = monthDayMatch;
    const iso = `${fallbackYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const parsedIso = new Date(iso);
    if (isFinite(parsedIso.getTime())) return parsedIso;
  }

  const parsedByName = new Date(`${trimmed} ${fallbackYear}`);
  if (isFinite(parsedByName.getTime())) return parsedByName;

  return null;
}

function trendFrom(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function chartPalette() {
  return {
    primary: '#2563eb',
    secondary: '#0ea5e9',
    accent: '#10b981',
    warn: '#f59e0b',
    danger: '#ef4444',
    neutral: '#64748b',
  };
}

function EmptyChart() {
  return <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">No data for the selected period.</div>;
}

function ChartCard({ title, children, className, rightContent }: { title: string; children: React.ReactNode; className?: string; rightContent?: React.ReactNode }) {
  return (
    <div className={`min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className || ''}`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h4 className="text-base font-bold text-gray-700 break-words">{title}</h4>
        {rightContent ? <div className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{rightContent}</div> : null}
      </div>
      {children}
    </div>
  );
}

function Kpi({ card }: { card: KpiCard }) {
  const up = card.trendPct >= 0;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.title}</p>
      <p className="mt-2 text-3xl font-bold text-blue-600">{card.value}</p>
      <p className="mt-1 text-sm text-gray-500">{card.detail}</p>
      <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
        {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        {`${up ? '+' : ''}${card.trendPct.toFixed(1)}%`}
      </div>
    </div>
  );
}

function ReportsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="inline-flex items-center gap-2">
            <SkeletonBlock className="h-9 w-28 rounded-full" />
            <SkeletonBlock className="h-9 w-20 rounded-full" />
            <SkeletonBlock className="h-9 w-24 rounded-full" />
          </div>
          <div className="inline-flex items-center gap-2 lg:ml-auto">
            <SkeletonBlock className="h-7 w-14" />
            <SkeletonBlock className="h-10 w-20 rounded-lg" />
            <SkeletonBlock className="h-10 w-24 rounded-lg" />
            <SkeletonBlock className="h-10 w-28 rounded-lg" />
            <SkeletonBlock className="h-10 w-24 rounded-lg" />
            <SkeletonBlock className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={`reports-kpi-skeleton-${idx}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <SkeletonBlock className="h-4 w-36" />
            <SkeletonBlock className="mt-3 h-10 w-32" />
            <SkeletonBlock className="mt-2 h-4 w-44" />
            <SkeletonBlock className="mt-3 h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>

      <div className="space-y-5">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <SkeletonBlock className="h-5 w-52" />
            <SkeletonBlock className="h-6 w-36 rounded-full" />
          </div>
          <SkeletonBlock className="h-[360px] w-full rounded-xl" />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <SkeletonBlock className="h-5 w-48" />
            <SkeletonBlock className="h-6 w-28 rounded-full" />
          </div>
          <SkeletonBlock className="h-[320px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function RevenueReports() {
  const now = new Date();
  const [category, setCategory] = useState<Category>('medication');
  const [preset, setPreset] = useState<Preset>('this_month');
  const [customStart, setCustomStart] = useState(toDateInput(startOfMonth(now)));
  const [customEnd, setCustomEnd] = useState(toDateInput(now));
  const [pendingStart, setPendingStart] = useState(customStart);
  const [pendingEnd, setPendingEnd] = useState(customEnd);
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(startOfMonth(now));
  const [systemMode, setSystemMode] = useState<SystemMode>(() => getSavedSystemMode());
  const [billingStatusData, setBillingStatusData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [billingTimelineData, setBillingTimelineData] = useState<Array<{ period: string; label: string; count: number; dailyBreakdown?: string }>>([]);
  const [isBillingGraphsLoading, setIsBillingGraphsLoading] = useState(false);
  const [billingDerivedRows, setBillingDerivedRows] = useState<BillingBillRow[]>([]);

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [demandTrend, setDemandTrend] = useState<DemandTrendResponse | null>(null);
  const [topMovers, setTopMovers] = useState<TopMoversResponse | null>(null);
  const [expiryRisk, setExpiryRisk] = useState<ExpiryRiskResponse | null>(null);
  const [revenueMix, setRevenueMix] = useState<RevenueMixResponse | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [bills, setBills] = useState<BillsResponse | null>(null);
  const [payments, setPayments] = useState<PaymentsResponse | null>(null);
  const [medicationCatalog, setMedicationCatalog] = useState<MedicationCatalogResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isCategorySwitching, setIsCategorySwitching] = useState(false);
  const [error, setError] = useState('');
  const hasMountedRef = useRef(false);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([]);
  const [isPaymentDataLoading, setIsPaymentDataLoading] = useState(true);
  const [pendingBillAmount, setPendingBillAmount] = useState(0);
  const [totalBilledAmount, setTotalBilledAmount] = useState(0);
  const colors = useMemo(() => chartPalette(), []);

  useEffect(() => {
    const syncMode = () => setSystemMode(getSavedSystemMode());
    window.addEventListener('storage', syncMode);
    window.addEventListener('focus', syncMode);
    window.addEventListener('clinikapluss:system-mode-changed', syncMode as EventListener);
    return () => {
      window.removeEventListener('storage', syncMode);
      window.removeEventListener('focus', syncMode);
      window.removeEventListener('clinikapluss:system-mode-changed', syncMode as EventListener);
    };
  }, []);

  const range = useMemo(() => {
    const end = toDateInput(now);
    if (preset === 'today') return { start: end, end };
    if (preset === 'this_week') return { start: toDateInput(startOfWeek(now)), end };
    if (preset === 'this_year') return { start: toDateInput(startOfYear(now)), end };
    if (preset === 'custom') return { start: customStart, end: customEnd };
    return { start: toDateInput(startOfMonth(now)), end };
  }, [preset, customStart, customEnd]);

  const rangeError = useMemo(() => {
    if (!pendingStart || !pendingEnd) return 'Start and end dates are required.';
    if (pendingEnd < pendingStart) return 'End date must be after start date.';
    return '';
  }, [pendingStart, pendingEnd]);

  const pendingStartDate = useMemo(() => fromDateInput(pendingStart), [pendingStart]);
  const pendingEndDate = useMemo(() => fromDateInput(pendingEnd), [pendingEnd]);
  const selectingEnd = Boolean(pendingStartDate && (!pendingEndDate || pendingEndDate < pendingStartDate));

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    setIsCategorySwitching(true);
    const timer = window.setTimeout(() => setIsCategorySwitching(false), 450);
    return () => window.clearTimeout(timer);
  }, [category]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      setIsLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          preset: preset === 'this_year' ? 'this_month' : preset,
          start_date: range.start,
          end_date: range.end,
          scope: 'all',
          bucket: 'day' as Bucket,
          topN: '10',
          limit: '10',
        });

        const [summaryRes, trendRes, moversRes, expiryRes, mixRes, analyticsRes, billsRes, paymentsRes, medsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/billing/reports/summary?${params.toString()}`, { signal: controller.signal, cache: 'no-store' }),
          fetch(`${API_BASE_URL}/billing/reports/medication-demand-trend?${params.toString()}`, { signal: controller.signal, cache: 'no-store' }),
          fetch(`${API_BASE_URL}/billing/reports/top-movers?${params.toString()}`, { signal: controller.signal, cache: 'no-store' }),
          fetch(`${API_BASE_URL}/billing/reports/expiry-risk?${params.toString()}`, { signal: controller.signal, cache: 'no-store' }),
          fetch(`${API_BASE_URL}/billing/reports/revenue-mix?${params.toString()}`, { signal: controller.signal, cache: 'no-store' }),
          fetch(`${API_BASE_URL}/billing/dashboard/analytics`, { signal: controller.signal, cache: 'no-store' }),
          fetch(`${API_BASE_URL}/billing/bills?page=1&page_size=100`, { signal: controller.signal, cache: 'no-store' }),
          fetch(`${API_BASE_URL}/billing/payments`, { signal: controller.signal, cache: 'no-store' }),
          fetch(`${API_BASE_URL}/medications`, { signal: controller.signal, cache: 'no-store' }),
        ]);

        if (!summaryRes.ok || !trendRes.ok || !moversRes.ok || !expiryRes.ok || !mixRes.ok || !analyticsRes.ok || !billsRes.ok || !paymentsRes.ok || !medsRes.ok) {
          throw new Error('Failed to load reports data.');
        }

        const [summaryJson, trendJson, moversJson, expiryJson, mixJson, analyticsJson, billsJson, paymentsJson, medsJson] = await Promise.all([
          summaryRes.json(),
          trendRes.json(),
          moversRes.json(),
          expiryRes.json(),
          mixRes.json(),
          analyticsRes.json(),
          billsRes.json(),
          paymentsRes.json(),
          medsRes.json(),
        ]);

        if (!active) return;
        setSummary(summaryJson as SummaryResponse);
        setDemandTrend(trendJson as DemandTrendResponse);
        setTopMovers(moversJson as TopMoversResponse);
        setExpiryRisk(expiryJson as ExpiryRiskResponse);
        setRevenueMix(mixJson as RevenueMixResponse);
        setAnalytics(analyticsJson as AnalyticsResponse);
        setBills(billsJson as BillsResponse);
        setPayments(paymentsJson as PaymentsResponse);
        setMedicationCatalog(medsJson as MedicationCatalogResponse);
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Failed to load reports.');
      } finally {
        if (!active || controller.signal.aborted) return;
        setIsLoading(false);
      }
    }

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [range.start, range.end, preset]);

  useEffect(() => {
    let active = true;

    async function loadPaymentDataAndBillTotals() {
      setIsPaymentDataLoading(true);
      try {
        if (!supabase) {
          if (!active) return;
          setPaymentRows([]);
          setPendingBillAmount(0);
          setTotalBilledAmount(0);
          return;
        }

        const startTs = new Date(`${range.start}T00:00:00`).getTime();
        const endTs = new Date(`${range.end}T23:59:59.999`).getTime();

        const paymentsQuery = supabase
          .schema('subsystem3')
          .from('tbl_payments')
          .select('amount_paid, payment_method, payment_date, created_at');

        const nativeBillsQuery = supabase
          .schema('subsystem3')
          .from('tbl_bills')
          .select('status, net_amount, bill_date, created_at');

        const queries = systemMode === 'integrated'
          ? await Promise.all([
            paymentsQuery,
            nativeBillsQuery,
            supabase
              .schema('public')
              .from('tbl_bills')
              .select('status, net_amount, bill_date, created_at'),
          ])
          : await Promise.all([paymentsQuery, nativeBillsQuery]);

        const paymentsResult = queries[0];
        if (paymentsResult.error) throw paymentsResult.error;
        const rawPaymentRows = (paymentsResult.data || []) as PaymentRow[];
        const nextPaymentRows = rawPaymentRows.filter((row) => {
          const ts = toTimestamp(row?.payment_date || row?.created_at);
          return ts !== null && ts >= startTs && ts <= endTs;
        });

        const nativeBillsResult = queries[1];
        if (nativeBillsResult.error) throw nativeBillsResult.error;
        const nativeBills = (nativeBillsResult.data || []) as BillAmountRow[];

        const integratedBills = systemMode === 'integrated' && queries.length > 2
          ? (() => {
            const result = queries[2];
            if (!result) return [] as BillAmountRow[];
            if (result.error) throw result.error;
            return (result.data || []) as BillAmountRow[];
          })()
          : [];

        const allBills = [...nativeBills, ...integratedBills].filter((row) => {
          const ts = toTimestamp(row?.bill_date || row?.created_at);
          return ts !== null && ts >= startTs && ts <= endTs;
        });
        const nextPendingAmount = allBills.reduce((sum, row) => {
          const status = String(row?.status || '').trim().toLowerCase();
          if (status !== 'pending') return sum;
          return sum + Number(row?.net_amount || 0);
        }, 0);
        const nextTotalBilledAmount = allBills.reduce((sum, row) => sum + Number(row?.net_amount || 0), 0);

        if (!active) return;
        setPaymentRows(nextPaymentRows);
        setPendingBillAmount(nextPendingAmount);
        setTotalBilledAmount(nextTotalBilledAmount);
      } catch (err) {
        if (!active) return;
        console.error('Failed to load payment KPI source data', err);
        setError((prev) => prev || 'Failed to load payment KPI source data.');
      } finally {
        if (active) setIsPaymentDataLoading(false);
      }
    }

    void loadPaymentDataAndBillTotals();
    return () => {
      active = false;
    };
  }, [range.start, range.end, systemMode]);

  useEffect(() => {
    let active = true;
    async function loadBillingGraphs() {
      setIsBillingGraphsLoading(true);
      try {
        if (!supabase) {
          if (!active) return;
          setBillingStatusData([]);
          setBillingTimelineData([]);
          setBillingDerivedRows([]);
          return;
        }
        const startTs = new Date(`${range.start}T00:00:00`).getTime();
        const endTs = new Date(`${range.end}T23:59:59.999`).getTime();
        const bucket: Bucket = preset === 'this_year' ? 'month' : 'day';
        const nativeQuery = supabase
          .schema('subsystem3')
          .from('tbl_bills')
          .select('status, created_at, bill_date, net_amount');

        const queries = systemMode === 'integrated'
          ? await Promise.all([
            nativeQuery,
            supabase
              .schema('public')
              .from('tbl_bills')
              .select('status, created_at, bill_date, net_amount'),
          ])
          : await Promise.all([nativeQuery]);

        const nativeResult = queries[0];
        if (nativeResult.error) throw nativeResult.error;
        const nativeRows = (nativeResult.data || []) as BillingBillRow[];

        const integratedRows = systemMode === 'integrated' && queries.length > 1
          ? (() => {
            const result = queries[1];
            if (!result) return [] as BillingBillRow[];
            if (result.error) throw result.error;
            return (result.data || []) as BillingBillRow[];
          })()
          : [];

        const allRows = [...nativeRows, ...integratedRows].filter((row) => {
          const ts = toTimestamp(row?.bill_date || row?.created_at);
          return ts !== null && ts >= startTs && ts <= endTs;
        });
        const statusMap = new Map<string, number>([
          ['Pending', 0],
          ['Paid', 0],
          ['Cancelled', 0],
        ]);
        const timelineMap = new Map<string, number>();
        const timelineDailyMap = new Map<string, Map<string, number>>();

        for (const row of allRows) {
          const normalizedStatus = normalizeBillStatusForDistribution(row.status);
          if (normalizedStatus) {
            statusMap.set(normalizedStatus, (statusMap.get(normalizedStatus) || 0) + 1);
          }
          const rowDate = row?.bill_date || row?.created_at || null;
          const createdAt = rowDate ? new Date(rowDate) : null;
          if (!createdAt || Number.isNaN(createdAt.getTime())) continue;
          const key = truncateByBucket(createdAt, bucket);
          timelineMap.set(key, (timelineMap.get(key) || 0) + 1);
          if (bucket === 'month') {
            const dayKey = toLocalIsoDate(createdAt);
            if (!timelineDailyMap.has(key)) timelineDailyMap.set(key, new Map<string, number>());
            const dayMap = timelineDailyMap.get(key)!;
            dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + 1);
          }
        }

        const nextStatusData = [
          { name: 'Pending', value: statusMap.get('Pending') || 0, color: '#f59e0b' },
          { name: 'Paid', value: statusMap.get('Paid') || 0, color: '#10b981' },
          { name: 'Cancelled', value: statusMap.get('Cancelled') || 0, color: '#ef4444' },
        ];
        const rangeStart = new Date(`${range.start}T00:00:00`);
        const rangeEnd = new Date(`${range.end}T00:00:00`);
        const timelineKeys = bucket === 'month'
          ? eachMonthInclusive(rangeStart, rangeEnd).map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`)
          : eachDayInclusive(rangeStart, rangeEnd).map((d) => toLocalIsoDate(d));
        const nextTimelineData = timelineKeys.map((period) => {
          const count = Number(timelineMap.get(period) || 0);
          if (bucket === 'month') {
            const monthDayMap = timelineDailyMap.get(period);
            const detail = monthDayMap
              ? [...monthDayMap.entries()]
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([day, qty]) => `${day.slice(-2)}: ${formatCount(qty)}`)
                  .join(' | ')
              : 'No daily bill activity in this month.';
            return {
              period,
              label: new Date(`${period}T00:00:00`).toLocaleDateString('en-US', { month: 'short' }),
              count,
              dailyBreakdown: detail,
            };
          }
          const dayDate = new Date(`${period}T00:00:00`);
          return {
            period,
            label: preset === 'this_week'
              ? dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : period,
            count,
          };
        });

        if (!active) return;
        setBillingDerivedRows(allRows);
        setBillingStatusData(nextStatusData);
        setBillingTimelineData(nextTimelineData);
      } catch {
        if (!active) return;
        setBillingDerivedRows([]);
        setBillingStatusData([]);
        setBillingTimelineData([]);
      } finally {
        if (active) setIsBillingGraphsLoading(false);
      }
    }

    void loadBillingGraphs();
    return () => {
      active = false;
    };
  }, [range.start, range.end, preset, systemMode]);

  const rising = topMovers?.rising || [];
  const revenueItems = revenueMix?.items || [];

  const topMedicationVolumeData = useMemo(() => {
    return [...rising]
      .map((item) => ({
        medication_name: String(item?.medication_name || 'Unknown'),
        volume: Number(item?.current_quantity || 0),
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
  }, [rising]);

  const dispensingVolumeTrendData = useMemo(() => {
    const start = fromDateInput(range.start);
    const end = fromDateInput(range.end);
    if (!start || !end) return [];

    const dailyMap = new Map<string, number>();
    const fallbackYear = new Date(range.start).getFullYear();
    for (const series of demandTrend?.series || []) {
      for (const point of series?.points || []) {
        const rawLabel = String(point?.label || '').trim();
        const dateValue = parseTrendLabelDate(rawLabel, fallbackYear) || new Date(rawLabel);
        if (!isFinite(dateValue.getTime())) continue;
        const key = toLocalIsoDate(dateValue);
        dailyMap.set(key, (dailyMap.get(key) || 0) + Number(point?.value || 0));
      }
    }

    if (preset === 'this_year') {
      return eachMonthInclusive(start, end).map((monthStart) => {
        const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
        const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        let total = 0;
        const parts: string[] = [];
        for (let day = 1; day <= daysInMonth; day += 1) {
          const dayKey = `${monthKey}-${String(day).padStart(2, '0')}`;
          const value = Number(dailyMap.get(dayKey) || 0);
          if (value > 0) parts.push(`${String(day).padStart(2, '0')}: ${formatCount(value)}`);
          total += value;
        }
        return { label: monthStart.toLocaleDateString('en-US', { month: 'short' }), volume: total, dailyBreakdown: parts.join(' | ') || 'No daily dispense activity in this month.' };
      });
    }

    const isWeek = preset === 'this_week';
    return eachDayInclusive(start, end).map((day) => {
      const key = toLocalIsoDate(day);
      const volume = Number(dailyMap.get(key) || 0);
      const label = isWeek
        ? day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : String(day.getDate());
      return { label, volume };
    });
  }, [demandTrend, range.start, range.end, preset]);

  const medicationRevenueTrendData = useMemo(() => {
    const start = fromDateInput(range.start);
    const end = fromDateInput(range.end);
    if (!start || !end) return [];

    const dailyMap = new Map<string, number>();
    for (const row of paymentRows) {
      const rawDate = String(row?.payment_date || row?.created_at || '').trim();
      if (!rawDate) continue;
      const date = new Date(rawDate);
      if (!isFinite(date.getTime())) continue;
      const key = toLocalIsoDate(date);
      dailyMap.set(key, (dailyMap.get(key) || 0) + Number(row?.amount_paid || 0));
    }

    if (preset === 'this_year') {
      return eachMonthInclusive(start, end).map((monthStart) => {
        const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
        const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        let total = 0;
        const parts: string[] = [];
        for (let day = 1; day <= daysInMonth; day += 1) {
          const dayKey = `${monthKey}-${String(day).padStart(2, '0')}`;
          const value = Number(dailyMap.get(dayKey) || 0);
          if (value > 0) parts.push(`${String(day).padStart(2, '0')}: ${formatPeso(value)}`);
          total += value;
        }
        return { label: monthStart.toLocaleDateString('en-US', { month: 'short' }), revenue: total, dailyBreakdown: parts.join(' | ') || 'No daily revenue activity in this month.' };
      });
    }

    const isWeek = preset === 'this_week';
    return eachDayInclusive(start, end).map((day) => {
      const key = toLocalIsoDate(day);
      const revenue = Number(dailyMap.get(key) || 0);
      const label = isWeek
        ? day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : String(day.getDate());
      return { label, revenue };
    });
  }, [paymentRows, range.start, range.end, preset]);

  const totalPrescriptions = (demandTrend?.series || []).reduce(
    (seriesSum, series) => seriesSum + (series?.points || []).reduce((pointSum, point) => pointSum + Number(point?.value || 0), 0),
    0
  );
  const totalDispensed = totalPrescriptions;
  const totalCollected = paymentRows.reduce((sum, row) => sum + Number(row?.amount_paid || 0), 0);
  const billingVolume = billingDerivedRows.reduce((sum, bill) => sum + Number(bill?.net_amount || 0), 0);
  const pendingAmount = pendingBillAmount;
  const medicationRevenue = revenueItems.reduce((sum, item) => sum + Number(item?.revenue || 0), 0);
  const averagePrescriptionValue = totalPrescriptions > 0 ? medicationRevenue / totalPrescriptions : 0;

  const topMedication = useMemo(() => {
    const byVolume = (demandTrend?.series || [])
      .map((series) => ({
        medication_name: String(series?.medication_name || 'N/A'),
        current_quantity: (series?.points || []).reduce((sum, point) => sum + Number(point?.value || 0), 0),
      }))
      .sort((a, b) => b.current_quantity - a.current_quantity)[0];

    if (byVolume && byVolume.current_quantity > 0) {
      return byVolume;
    }

    const summaryTop = summary?.insights?.top_medication_by_revenue;
    if (summaryTop?.medication_name) {
      return { medication_name: summaryTop.medication_name, current_quantity: Math.max(1, Math.round(Number(summaryTop.revenue || 0))) };
    }

    if (rising.length === 0) return null;
    const sorted = [...rising].sort((a, b) => Number(b.current_quantity || 0) - Number(a.current_quantity || 0));
    return sorted[0];
  }, [rising, summary, demandTrend]);

  const topMethod = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of paymentRows) {
      const key = String(row?.payment_method || 'Unknown').trim() || 'Unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let bestMethod = 'N/A';
    let bestCount = 0;
    counts.forEach((count, method) => {
      if (count > bestCount) {
        bestCount = count;
        bestMethod = method;
      }
    });
    return { method: bestMethod, count: bestCount };
  }, [paymentRows]);

  const collectionRate = useMemo(() => {
    if (totalBilledAmount <= 0) return 0;
    return (totalCollected / totalBilledAmount) * 100;
  }, [totalCollected, totalBilledAmount]);

  const paymentRevenueDailyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of paymentRows) {
      const raw = String(row?.payment_date || row?.created_at || '').trim();
      if (!raw) continue;
      const date = new Date(raw);
      if (!isFinite(date.getTime())) continue;
      const key = toLocalIsoDate(date);
      map.set(key, (map.get(key) || 0) + Number(row?.amount_paid || 0));
    }
    return map;
  }, [paymentRows]);

  const paymentRevenueTrendData = useMemo(() => {
    const start = fromDateInput(range.start);
    const end = fromDateInput(range.end);
    if (!start || !end) return [];

    if (preset === 'this_year') {
      return eachMonthInclusive(start, end).map((monthStart) => {
        const monthKey = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`;
        const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
        let monthlyTotal = 0;
        const parts: string[] = [];
        for (let day = 1; day <= daysInMonth; day += 1) {
          const dayKey = `${monthKey}-${String(day).padStart(2, '0')}`;
          const value = Number(paymentRevenueDailyMap.get(dayKey) || 0);
          if (value > 0) {
            parts.push(`${String(day).padStart(2, '0')}: ${formatPeso(value)}`);
          }
          monthlyTotal += value;
        }

        return {
          label: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          revenue: monthlyTotal,
          dailyBreakdown: parts.length ? parts.join(' | ') : 'No daily collections in this month.',
        };
      });
    }

    const rangeDays = eachDayInclusive(start, end);
    const isWeek = preset === 'this_week';
    const isMonth = preset === 'this_month';
    return rangeDays.map((day) => {
      const key = toLocalIsoDate(day);
      const revenue = Number(paymentRevenueDailyMap.get(key) || 0);
      const label = isWeek
        ? day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
        : isMonth
          ? String(day.getDate())
          : day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return { label, revenue };
    });
  }, [paymentRevenueDailyMap, range.start, range.end, preset]);

  const paymentMethodBreakdownData = useMemo(() => {
    const byMethod = new Map<string, number>();
    for (const row of paymentRows) {
      const key = String(row?.payment_method || 'Unknown').trim() || 'Unknown';
      byMethod.set(key, (byMethod.get(key) || 0) + Number(row?.amount_paid || 0));
    }

    const palette = [colors.primary, colors.secondary, colors.accent, colors.warn, colors.danger, colors.neutral];
    return [...byMethod.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, value], index) => ({
        name,
        value,
        color: palette[index % palette.length],
      }));
  }, [paymentRows, colors.primary, colors.secondary, colors.accent, colors.warn, colors.danger, colors.neutral]);

  const kpis: KpiCard[] = useMemo(() => {
    const p = chartPalette();
    void p;
    if (category === 'medication') {
      return [
        { title: 'Medications Dispensed', value: formatCount(totalDispensed), detail: 'Units dispensed this period', trendPct: trendFrom(totalDispensed, Math.max(1, totalDispensed * 0.9)) },
        { title: 'Top Medication', value: topMedication ? `${topMedication.medication_name}` : 'N/A', detail: 'Highest unit volume', trendPct: 6.4 },
        { title: 'Medication Revenue', value: formatPeso(medicationRevenue), detail: 'Revenue from dispensed meds', trendPct: trendFrom(medicationRevenue, Math.max(1, medicationRevenue * 0.9)) },
        { title: 'Average Prescription Value', value: formatPeso(averagePrescriptionValue), detail: 'Avg revenue per unit', trendPct: trendFrom(averagePrescriptionValue, Math.max(0.01, averagePrescriptionValue * 0.95)) },
      ];
    }
    if (category === 'billing') {
      const totalInvoices = billingDerivedRows.length;
      const paid = billingDerivedRows.filter((b) => String(b.status || '').toLowerCase() === 'paid').length;
      const outstanding = billingDerivedRows.reduce((sum, row) => {
        const status = String(row?.status || '').toLowerCase();
        if (status !== 'pending') return sum;
        return sum + Number(row?.net_amount || 0);
      }, 0);
      const averageInvoice = totalInvoices > 0
        ? billingDerivedRows.reduce((sum, row) => sum + Number(row?.net_amount || 0), 0) / totalInvoices
        : 0;
      const success = totalInvoices ? (paid / totalInvoices) * 100 : 0;
      return [
        { title: 'Total Invoices', value: formatCount(totalInvoices), detail: 'Generated this period', trendPct: 4.1 },
        { title: 'Outstanding Balance', value: formatPeso(outstanding), detail: 'Unpaid as of today', trendPct: -2.3 },
        { title: 'Average Invoice Value', value: formatPeso(averageInvoice), detail: 'Per transaction', trendPct: 3.9 },
        { title: 'Billing Success Rate', value: `${success.toFixed(1)}%`, detail: 'Paid vs. total invoiced', trendPct: 2.6 },
      ];
    }
    if (category === 'payment') {
      return [
        { title: 'Total Collected', value: formatPeso(totalCollected), detail: 'From subsystem3 payments', trendPct: 5.2 },
        { title: 'Pending Payments', value: formatPeso(pendingAmount), detail: 'Awaiting collection', trendPct: -1.1 },
        { title: 'Top Payment Method', value: `${topMethod.method}`, detail: `${formatCount(topMethod.count)} transactions`, trendPct: 0.8 },
        { title: 'Collection Rate', value: `${collectionRate.toFixed(1)}%`, detail: 'Collected vs total billed', trendPct: collectionRate >= 70 ? 2.4 : -1.8 },
      ];
    }
    return [
      { title: 'Prescriptions Filled', value: formatCount(totalPrescriptions), detail: 'Total for selected period', trendPct: trendFrom(totalPrescriptions, Math.max(1, totalPrescriptions * 0.9)) },
      { title: 'Top Medication', value: topMedication ? `${topMedication.medication_name}` : 'N/A', detail: topMedication ? `${formatCount(topMedication.current_quantity)} units` : 'No activity', trendPct: 6.4 },
      { title: 'Expired Stock Alerts', value: formatCount(expiryRisk?.metrics?.near_expiry_quantity || 0), detail: 'Requires immediate action', trendPct: -3.2 },
      { title: 'Average Dispense Time', value: '12 mins', detail: 'From receipt to release', trendPct: -4.8 },
    ];
  }, [category, totalPrescriptions, totalDispensed, billingVolume, totalCollected, topMedication, billingDerivedRows, pendingAmount, topMethod, collectionRate, medicationRevenue, averagePrescriptionValue]);

  const medicationCategorySlices = useMemo(() => {
    const nameToCategory = new Map<string, string>();
    for (const row of medicationCatalog?.items || []) {
      const name = String(row?.medication_name || '').trim().toLowerCase();
      const category = String(row?.category_name || '').trim();
      if (name) nameToCategory.set(name, category || 'Unspecified');
    }

    const categoryTotals = new Map<string, number>();
    for (const series of demandTrend?.series || []) {
      const medName = String(series?.medication_name || '').trim().toLowerCase();
      const volume = (series?.points || []).reduce((sum, point) => sum + Number(point?.value || 0), 0);
      const category = nameToCategory.get(medName) || 'Unspecified';
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + volume);
    }

    const palette = [
      colors.primary,
      colors.secondary,
      colors.accent,
      colors.warn,
      colors.danger,
      colors.neutral,
      '#8b5cf6',
      '#0ea5e9',
      '#f97316',
      '#14b8a6',
    ];

    return [...categoryTotals.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([label, value], index) => ({
        label,
        value,
        color: palette[index % palette.length],
      }))
      .filter((slice) => slice.value > 0);
  }, [medicationCatalog, demandTrend, colors.primary, colors.secondary, colors.accent, colors.warn, colors.danger, colors.neutral]);

  const medicationCategorySummary = useMemo(() => {
    const totalUnits = medicationCategorySlices.reduce((sum, slice) => sum + slice.value, 0);
    const topSlice = medicationCategorySlices.reduce(
      (prev, current) => (current.value > prev.value ? current : prev),
      { label: 'None', value: 0, color: colors.neutral }
    );
    return {
      totalUnits,
      topCategory: topSlice.label,
      topUnits: topSlice.value,
      topSharePct: totalUnits ? (topSlice.value / totalUnits) * 100 : 0,
      categoryCount: medicationCategorySlices.length,
    };
  }, [medicationCategorySlices, colors.neutral]);

  const billingDonutInsights = useMemo(() => {
    const pending = billingStatusData.find((item) => item.name === 'Pending')?.value || 0;
    const paid = billingStatusData.find((item) => item.name === 'Paid')?.value || 0;
    const cancelled = billingStatusData.find((item) => item.name === 'Cancelled')?.value || 0;
    const total = pending + paid + cancelled;
    if (!total) {
      return {
        headline: 'No billing activity for the selected range yet.',
        pipeline: 'Once bills are created, this section will summarize flow quality and risk signals.',
        operations: 'Use the date filter to compare billing momentum across periods.',
      };
    }

    const paidPct = (paid / total) * 100;
    const pendingPct = (pending / total) * 100;
    const cancelledPct = (cancelled / total) * 100;
    const dominant = paid >= pending && paid >= cancelled ? 'Paid' : pending >= cancelled ? 'Pending' : 'Cancelled';
    const headline = dominant === 'Paid'
      ? `Collections are leading: ${paidPct.toFixed(1)}% of bills are Paid (${formatCount(paid)} of ${formatCount(total)}).`
      : dominant === 'Pending'
        ? `Pipeline pressure is elevated: ${pendingPct.toFixed(1)}% of bills are Pending (${formatCount(pending)} of ${formatCount(total)}).`
        : `Cancellation volume is currently highest at ${cancelledPct.toFixed(1)}% (${formatCount(cancelled)} of ${formatCount(total)}).`;

    const pipeline = pendingPct >= 40
      ? `Pending share is above 40%, which usually signals collection lag or billing follow-up backlog.`
      : `Pending share is ${pendingPct.toFixed(1)}%, indicating a manageable active billing queue.`;
    const operations = cancelledPct >= 15
      ? `Cancelled bills are at ${cancelledPct.toFixed(1)}%; review cancellation reasons for preventable drop-offs.`
      : `Cancelled bills remain at ${cancelledPct.toFixed(1)}%, suggesting stable billing completion behavior.`;

    return { headline, pipeline, operations };
  }, [billingStatusData]);

  const paymentDonutInsights = useMemo(() => {
    const total = paymentMethodBreakdownData.reduce((sum, row) => sum + Number(row?.value || 0), 0);
    if (!total) {
      return {
        headline: 'No payment collection mix is available for the selected range yet.',
        concentration: 'Once payments are posted, this section will highlight method concentration and channel balance.',
        operations: 'Use this to monitor dependence on a single payment channel and diversify if needed.',
        topMethod: 'N/A',
        topSharePct: 0,
        methodCount: 0,
      };
    }

    const sorted = [...paymentMethodBreakdownData].sort((a, b) => Number(b.value || 0) - Number(a.value || 0));
    const top = sorted[0];
    const topValue = Number(top?.value || 0);
    const topSharePct = (topValue / total) * 100;
    const methodCount = sorted.length;

    const headline = topSharePct >= 75
      ? `${top?.name || 'Top method'} dominates collections at ${topSharePct.toFixed(1)}% (${formatPeso(topValue)} of ${formatPeso(total)}).`
      : `${top?.name || 'Top method'} leads collections at ${topSharePct.toFixed(1)}% (${formatPeso(topValue)} of ${formatPeso(total)}), with a healthier channel mix.`;

    const concentration = topSharePct >= 85
      ? 'Collection concentration is high. Consider reinforcing alternate payment options to reduce single-channel risk.'
      : topSharePct >= 65
        ? 'Collection concentration is moderate. Keep monitoring shifts to avoid over-reliance on one method.'
        : 'Collection mix is relatively balanced across channels for this period.';

    const operations = methodCount <= 1
      ? 'Only one payment method was used in this range. Validate if this reflects policy or operational constraints.'
      : `You processed collections across ${methodCount} methods. Track changes week-over-week to catch channel drift early.`;

    return {
      headline,
      concentration,
      operations,
      topMethod: String(top?.name || 'N/A'),
      topSharePct,
      methodCount,
    };
  }, [paymentMethodBreakdownData]);

  const shouldShowPageSkeleton = isLoading || isCategorySwitching || (category === 'payment' && isPaymentDataLoading);

  return (
    <section className="rounded-2xl bg-gray-300/80 p-6">
      {showRangeModal && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-md px-4 py-6">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900">Select Date Range</h3>
              <button type="button" onClick={() => setShowRangeModal(false)} className="rounded-full bg-gray-100 p-2 text-gray-600"><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Start Date</p>
                  <p className="text-sm font-bold text-gray-800">{pendingStartDate ? pendingStartDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Select date'}</p>
                </div>
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">End Date</p>
                  <p className="text-sm font-bold text-gray-800">{pendingEndDate ? pendingEndDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Select date'}</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((prev) => addMonths(prev, -1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                    aria-label="Previous month"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <p className="text-sm font-bold text-gray-800">{monthLabel(calendarMonth)}</p>
                  <button
                    type="button"
                    onClick={() => setCalendarMonth((prev) => addMonths(prev, 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                    aria-label="Next month"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{d}</span>)}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {Array.from({ length: 42 }).map((_, idx) => {
                    const first = startOfCalendarGrid(calendarMonth);
                    const day = shiftDays(first, idx);
                    const inCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                    const isStart = pendingStartDate ? isSameDay(day, pendingStartDate) : false;
                    const isEnd = pendingEndDate ? isSameDay(day, pendingEndDate) : false;
                    const inRange = pendingStartDate && pendingEndDate ? isBetween(day, pendingStartDate, pendingEndDate) : false;
                    return (
                      <button
                        key={`${day.toISOString()}-${idx}`}
                        type="button"
                        onClick={() => {
                          const selected = toDateInput(day);
                          if (!pendingStartDate || (pendingStartDate && pendingEndDate)) {
                            setPendingStart(selected);
                            setPendingEnd('');
                            return;
                          }
                          if (pendingStartDate && !pendingEndDate) {
                            if (day.getTime() < pendingStartDate.getTime()) {
                              setPendingEnd(pendingStart);
                              setPendingStart(selected);
                            } else {
                              setPendingEnd(selected);
                            }
                          }
                        }}
                        className={`h-9 rounded-lg text-sm font-semibold transition ${
                          isStart || isEnd
                            ? 'bg-blue-600 text-white'
                            : inRange
                              ? 'bg-blue-100 text-blue-700'
                              : inCurrentMonth
                                ? 'bg-white text-gray-700 hover:bg-blue-50'
                                : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <p className="text-xs font-medium text-gray-500">
                {selectingEnd ? 'Select an end date to complete the range.' : 'Select start and end dates from the calendar.'}
              </p>
              {rangeError && <p className="text-sm text-rose-600">{rangeError}</p>}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowRangeModal(false)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700">Cancel</button>
                <button
                  type="button"
                  onClick={() => {
                    if (rangeError) return;
                    setCustomStart(pendingStart);
                    setCustomEnd(pendingEnd);
                    setPreset('custom');
                    setShowRangeModal(false);
                  }}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {shouldShowPageSkeleton ? (
        <ReportsPageSkeleton />
      ) : (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="inline-flex items-center gap-2">
              {[
                { key: 'medication', label: 'Medication' },
                { key: 'billing', label: 'Billing' },
                { key: 'payment', label: 'Payment' },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setCategory(chip.key as Category)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition ${category === chip.key ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-700'}`}
                >
                  {chip.label}
                </button>
              ))}
              </div>

              <div className="inline-flex items-center gap-2 lg:ml-auto">
                <span className="inline-flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <CalendarRange size={14} />
                  Date
                </span>
                {[
                  { key: 'today', label: 'Today' },
                  { key: 'this_week', label: 'This Week' },
                  { key: 'this_month', label: 'This Month' },
                  { key: 'this_year', label: 'This Year' },
                  { key: 'custom', label: 'Custom Range' },
                ].map((button) => (
                  <button
                    key={button.key}
                    type="button"
                    onClick={() => {
                      if (button.key === 'custom') {
                        setPendingStart(customStart);
                        setPendingEnd(customEnd);
                        setCalendarMonth(fromDateInput(customStart) || startOfMonth(new Date()));
                        setShowRangeModal(true);
                      } else {
                        setPreset(button.key as Preset);
                      }
                    }}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${preset === button.key ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700'}`}
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((card) => <Kpi key={card.title} card={card} />)}
          </div>

          <div className="mt-6 space-y-5">
        {category === 'medication' && (
          <>
            <div className="grid grid-cols-1 gap-4">
              <ChartCard
                title="Top 10 Medications by Volume"
                className="min-h-[30rem]"
                rightContent={`${formatCount(topMedicationVolumeData.reduce((sum, item) => sum + item.volume, 0))} total units`}
              >
                {topMedicationVolumeData.length ? (
                  <ResponsiveContainer width="100%" height={360} minWidth={0} minHeight={280}>
                    <BarChart
                      layout="vertical"
                      data={topMedicationVolumeData}
                      margin={{ top: 12, right: 28, left: 0, bottom: 16 }}
                      barCategoryGap="20%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={chartTextStyle} />
                      <YAxis
                        dataKey="medication_name"
                        type="category"
                        width={240}
                        tickLine={false}
                        axisLine={false}
                        tick={LeftAlignedYAxisTick}
                        tickMargin={8}
                      />
                      <Tooltip
                        formatter={(value) => [formatCount(Number(value || 0)), 'Units dispensed']}
                        contentStyle={{ fontSize: 12, borderRadius: 12, borderColor: '#e2e8f0' }}
                        itemStyle={{ fontSize: 12 }}
                        labelStyle={{ fontSize: 12 }}
                        cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                      />
                      <Bar dataKey="volume" fill={colors.accent} radius={[12, 12, 12, 12]} animationDuration={900} barSize={16}>
                        <LabelList dataKey="volume" position="right" formatter={(value) => formatCount(Number(value || 0))} style={{ fill: '#0f172a', fontSize: 12, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>
              <ChartCard title="Dispensing by Medication Category" className="min-h-[30rem]">
                {medicationCategorySlices.length ? (
                  <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] min-w-0">
                    <div className="min-w-0 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="mt-4 h-[280px] min-w-0">
                        <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={240}>
                          <PieChart>
                            <Pie
                              data={medicationCategorySlices}
                              dataKey="value"
                              nameKey="label"
                              cx="50%"
                              cy="50%"
                              innerRadius={68}
                              outerRadius={112}
                              paddingAngle={4}
                              animationDuration={900}
                            >
                              {medicationCategorySlices.map((entry) => (
                                <Cell key={entry.label} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => [formatCount(Number(value || 0)), 'Units']}
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                              itemStyle={{ fontSize: 12 }}
                              labelStyle={{ fontSize: 12 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 text-sm text-gray-600">
                        {medicationCategorySlices.map((slice) => (
                          <div key={slice.label} className="min-w-0 flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: slice.color }} />
                              <span className="min-w-0 truncate text-slate-800">{slice.label}</span>
                            </div>
                            <span className="font-semibold text-slate-900">{((slice.value / medicationCategorySummary.totalUnits) * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="min-w-0 rounded-2xl border-l-4 border-blue-500 bg-blue-50 p-3 shadow-sm">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="rounded-2xl bg-blue-100 p-2 text-blue-700">
                            <Layers size={18} />
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Total category volume</p>
                            <p className="mt-1 text-xl font-bold text-slate-900">{formatCount(medicationCategorySummary.totalUnits)} units</p>
                            <p className="mt-1 text-sm text-slate-600">Volume across {medicationCategorySummary.categoryCount} categories.</p>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 rounded-2xl border-l-4 border-emerald-500 bg-emerald-50 p-3 shadow-sm">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="rounded-2xl bg-emerald-100 p-2 text-emerald-700">
                            <ShieldCheck size={18} />
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Leading category</p>
                            <p className="mt-1 text-xl font-bold text-slate-900">{medicationCategorySummary.topCategory}</p>
                            <p className="mt-1 text-sm text-slate-600">{formatCount(medicationCategorySummary.topUnits)} units · {medicationCategorySummary.topSharePct.toFixed(1)}% share</p>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 rounded-2xl border-l-4 border-sky-500 bg-sky-50 p-3 shadow-sm">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="rounded-2xl bg-sky-100 p-2 text-sky-700">
                            <TrendingUp size={18} />
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Category mix</p>
                            <p className="mt-1 text-base font-semibold text-slate-900">{medicationCategorySummary.categoryCount} active categories</p>
                            <p className="mt-1 text-sm text-slate-600">Balanced view of dispensing diversity.</p>
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0 rounded-2xl border-l-4 border-violet-500 bg-violet-50 p-3 shadow-sm">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className="rounded-2xl bg-violet-100 p-2 text-violet-700">
                            <Percent size={18} />
                          </span>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Most dominant segment</p>
                            <p className="mt-1 text-base font-semibold text-slate-900">{medicationCategorySummary.topCategory}</p>
                            <p className="mt-1 text-sm text-slate-600">Largest share of dispensed units this period.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <ChartCard title="Dispensing Volume Over Time" className="min-h-[28rem]">
                {dispensingVolumeTrendData.length ? (
                  <ResponsiveContainer width="100%" height={360} minWidth={0} minHeight={280}>
                    <LineChart data={dispensingVolumeTrendData} margin={{ top: 16, right: 24, left: 0, bottom: 32 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                        tick={chartTextStyle}
                        tickMargin={10}
                        height={44}
                        minTickGap={preset === 'this_month' ? 4 : 20}
                        interval={preset === 'this_month' ? 0 : 'preserveStartEnd'}
                      />
                      <YAxis tickLine={false} axisLine={false} tick={chartTextStyle} tickMargin={10} />
                      <Tooltip
                        formatter={(value) => [formatCount(Number(value || 0)), 'Units']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        itemStyle={{ fontSize: 12 }}
                        labelStyle={{ fontSize: 12 }}
                        labelFormatter={(label, payload) => {
                          if (preset !== 'this_year') return String(label || '');
                          const detail = String(payload?.[0]?.payload?.dailyBreakdown || '').trim();
                          return detail ? `${String(label || '')} | ${detail}` : String(label || '');
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="volume"
                        stroke={colors.primary}
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        animationDuration={900}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>
              <ChartCard title="Medication Revenue Over Time" className="min-h-[28rem]">
                {medicationRevenueTrendData.length ? (
                  <ResponsiveContainer width="100%" height={360} minWidth={0} minHeight={280}>
                    <LineChart data={medicationRevenueTrendData} margin={{ top: 16, right: 20, left: 0, bottom: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                        tick={chartTextStyle}
                        tickMargin={10}
                        height={44}
                        minTickGap={preset === 'this_month' ? 4 : 20}
                        interval={preset === 'this_month' ? 0 : 'preserveStartEnd'}
                      />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatPeso(Number(value))} tick={chartTextStyle} />
                      <Tooltip
                        formatter={(value) => [formatPeso(Number(value || 0)), 'Revenue']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        itemStyle={{ fontSize: 12 }}
                        labelStyle={{ fontSize: 12 }}
                        labelFormatter={(label, payload) => {
                          if (preset !== 'this_year') return String(label || '');
                          const detail = String(payload?.[0]?.payload?.dailyBreakdown || '').trim();
                          return detail ? `${String(label || '')} | ${detail}` : String(label || '');
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke={colors.warn}
                        strokeWidth={3}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                        animationDuration={900}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>
            </div>
          </>
        )}

        {category === 'billing' && (
          <>
            <div className="grid grid-cols-1 gap-6">
              <ChartCard title="Bill Status Distribution" className="min-h-[24rem]">
                {isBillingGraphsLoading ? (
                  <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Loading bill status distribution...</div>
                ) : billingStatusData.reduce((sum, item) => sum + item.value, 0) > 0 ? (
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
                    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-3 sm:p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                          <Layers size={14} />
                          Status Mix
                        </div>
                        <span className="text-xs font-semibold text-gray-500">
                          {formatCount(billingStatusData.reduce((sum, item) => sum + item.value, 0))} bills
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={260} minWidth={0} minHeight={220}>
                        <PieChart>
                          <Pie data={billingStatusData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                            {billingStatusData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                          </Pie>
                          <Tooltip formatter={(value) => [formatCount(Number(value || 0)), 'Bills']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-gray-700">
                        {billingStatusData.map((entry) => (
                          <div key={`legend-${entry.name}`} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="font-medium">{entry.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                      <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                        <ShieldCheck size={14} />
                        Operational Insights
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                          <p>{billingDonutInsights.headline}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                          <p>{billingDonutInsights.pipeline}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
                          <p>{billingDonutInsights.operations}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                        {billingStatusData.map((entry) => (
                          <div key={`insight-metric-${entry.name}`} className="rounded-lg border border-gray-200 bg-white p-2">
                            <p className="text-[11px] font-semibold" style={{ color: entry.color }}>{entry.name}</p>
                            <p className="text-base font-bold" style={{ color: entry.color }}>{formatCount(entry.value)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>
              <ChartCard title="Bills Created Over Time" className="min-h-[24rem]">
                {isBillingGraphsLoading ? (
                  <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Loading bills over time...</div>
                ) : billingTimelineData.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-3 sm:p-4">
                    <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={240}>
                      <BarChart data={billingTimelineData} margin={{ top: 14, right: 18, left: 4, bottom: 10 }} barCategoryGap="28%">
                        <defs>
                          <linearGradient id="billingBarsGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.95} />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.9} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="4 6" stroke="#e2e8f0" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ ...chartTextStyle, fill: '#64748b', fontSize: 11 }}
                          tickLine={false}
                          axisLine={{ stroke: '#cbd5e1' }}
                          tickMargin={10}
                          interval={preset === 'this_month' ? 0 : 'preserveStartEnd'}
                          minTickGap={preset === 'this_month' ? 4 : 16}
                        />
                        <YAxis
                          tick={{ ...chartTextStyle, fill: '#64748b', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          width={36}
                        />
                        <Tooltip
                          formatter={(value) => [formatCount(Number(value || 0)), 'Bills']}
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                          }}
                          labelStyle={{ color: '#0f172a', fontWeight: 600 }}
                          labelFormatter={(label, payload) => {
                            if (preset !== 'this_year') return String(label || '');
                            const detail = String(payload?.[0]?.payload?.dailyBreakdown || '').trim();
                            return detail ? `${String(label || '')} | ${detail}` : String(label || '');
                          }}
                        />
                        <Bar dataKey="count" fill="url(#billingBarsGradient)" radius={[10, 10, 0, 0]} maxBarSize={44} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>
            </div>
          </>
        )}

        {category === 'payment' && (
          <>
            <div className="grid grid-cols-1 gap-6">
              <ChartCard
                title="Revenue Trend"
                className="min-h-[26rem]"
                rightContent={<span>Based on selected date filter</span>}
              >
                {isPaymentDataLoading ? (
                  <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Loading revenue trend...</div>
                ) : paymentRevenueTrendData.length > 0 ? (
                  <div className="min-w-0 w-full">
                    <ResponsiveContainer width="100%" height={320} minWidth={0} minHeight={240}>
                      <LineChart data={paymentRevenueTrendData} margin={{ top: 12, right: 14, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="label"
                          tick={{ ...chartTextStyle, fill: '#64748b', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          interval={preset === 'this_month' ? 0 : 'preserveStartEnd'}
                          minTickGap={preset === 'this_month' ? 4 : 20}
                        />
                        <YAxis
                          tick={{ ...chartTextStyle, fill: '#64748b', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `PHP ${Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`}
                          width={72}
                        />
                        <Tooltip
                          formatter={(value) => [formatPeso(Number(value || 0)), 'Collected']}
                          contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
                          labelFormatter={(label, payload) => {
                            if (preset !== 'this_year') return String(label || '');
                            const detail = String(payload?.[0]?.payload?.dailyBreakdown || '').trim();
                            return detail ? `${String(label || '')} | ${detail}` : String(label || '');
                          }}
                        />
                        <Line type="monotone" dataKey="revenue" stroke={colors.primary} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>
              <ChartCard title="Payment Method Breakdown" className="min-h-[25rem]">
                {isPaymentDataLoading ? (
                  <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">Loading payment method breakdown...</div>
                ) : paymentMethodBreakdownData.length > 0 ? (
                  <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
                    <div className="min-w-0 w-full">
                      <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={240}>
                        <PieChart>
                          <Pie data={paymentMethodBreakdownData} dataKey="value" nameKey="name" innerRadius={68} outerRadius={108} paddingAngle={3}>
                            {paymentMethodBreakdownData.map((entry) => (
                              <Cell key={`payment-method-slice-${entry.name}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [formatPeso(Number(value || 0)), 'Collected']} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                        <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-gray-600">
                          <Percent size={13} />
                          Collection Insights
                        </div>
                        <div className="space-y-2">
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                            <p>{paymentDonutInsights.headline}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                            <p>{paymentDonutInsights.concentration}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                            <p>{paymentDonutInsights.operations}</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-lg border border-gray-200 bg-white p-2">
                            <p className="text-[11px] font-semibold text-gray-500">Top Method</p>
                            <p className="text-base font-bold text-slate-900">{paymentDonutInsights.topMethod}</p>
                          </div>
                          <div className="rounded-lg border border-gray-200 bg-white p-2">
                            <p className="text-[11px] font-semibold text-gray-500">Top Share</p>
                            <p className="text-base font-bold text-slate-900">{paymentDonutInsights.topSharePct.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                      {paymentMethodBreakdownData.map((entry) => {
                        const pct = totalCollected > 0 ? (entry.value / totalCollected) * 100 : 0;
                        return (
                          <div key={`payment-method-row-${entry.name}`} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="inline-flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-sm font-semibold text-gray-800">{entry.name}</span>
                              </div>
                              <span className="text-sm font-semibold text-gray-700">{pct.toFixed(1)}%</span>
                            </div>
                            <p className="mt-1 text-xs font-medium text-gray-500">{formatPeso(entry.value)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <EmptyChart />
                )}
              </ChartCard>
            </div>
          </>
        )}
      </div>
        </>
      )}
    </section>
  );
}
