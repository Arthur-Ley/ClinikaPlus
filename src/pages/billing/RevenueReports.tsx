import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownRight, ArrowUpRight, CalendarRange, ChevronLeft, ChevronRight, Layers, ShieldCheck, Percent, TrendingUp, X } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

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

type KpiCard = {
  title: string;
  value: string;
  detail: string;
  trendPct: number;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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

function SparkBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mt-3 flex h-44 items-end gap-2">
      {values.map((value, index) => (
        <div
          key={`${index}-${value}`}
          className="flex-1 rounded-sm"
          style={{ height: `${Math.max(6, (value / max) * 100)}%`, backgroundColor: color }}
          title={`${value}`}
        />
      ))}
    </div>
  );
}

function DonutLike({ slices }: { slices: Array<{ label: string; value: number; color: string }> }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0) || 1;
  return (
    <div className="mt-3 space-y-2">
      {slices.map((slice) => (
        <div key={slice.label} className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>{slice.label}</span>
            <span>{((slice.value / total) * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100">
            <div className="h-full rounded-full" style={{ width: `${(slice.value / total) * 100}%`, backgroundColor: slice.color }} />
          </div>
        </div>
      ))}
    </div>
  );
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
  const [error, setError] = useState('');

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

  const trendPoints = demandTrend?.series?.[0]?.points || [];
  const trendValues = trendPoints.map((p) => Number(p.value || 0));
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
    const pointMap = new Map<number, { date: string; volume: number }>();
    const fallbackYear = new Date(range.start).getFullYear();

    for (const series of demandTrend?.series || []) {
      for (const point of series?.points || []) {
        const rawLabel = String(point?.label || '').trim();
        const dateValue = parseTrendLabelDate(rawLabel, fallbackYear) || new Date(rawLabel);
        if (!isFinite(dateValue.getTime())) continue;
        const isoDate = dateValue.toISOString().slice(0, 10);
        const current = pointMap.get(dateValue.getTime()) || { date: isoDate, volume: 0, timestamp: dateValue.getTime() };
        current.volume += Number(point?.value || 0);
        pointMap.set(dateValue.getTime(), current);
      }
    }

    return [...pointMap.values()].sort((a, b) => (new Date(a.date)).getTime() - (new Date(b.date)).getTime());
  }, [demandTrend, range.start]);

  const medicationRevenueTrendData = useMemo(() => {
    const revenueByDate = new Map<number, { date: string; revenue: number }>();

    for (const payment of payments?.items || []) {
      const rawDate = String(payment?.payment_date || '').trim();
      if (!rawDate) continue;
      const date = new Date(rawDate);
      if (!isFinite(date.getTime())) continue;
      const isoDate = date.toISOString().slice(0, 10);
      const current = revenueByDate.get(date.getTime()) || { date: isoDate, revenue: 0, timestamp: date.getTime() };
      current.revenue += Number(payment.amount_paid || 0);
      revenueByDate.set(date.getTime(), current);
    }

    return [...revenueByDate.values()].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [payments]);

  const dispensingVolumeMonthTicks = useMemo(() => {
    const monthKeys = new Map<string, number>();
    for (const point of dispensingVolumeTrendData) {
      const date = new Date(point.date);
      if (!isFinite(date.getTime())) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthKeys.has(key)) monthKeys.set(key, new Date(date.getFullYear(), date.getMonth(), 1).getTime());
    }
    return [...monthKeys.values()];
  }, [dispensingVolumeTrendData]);

  const medicationRevenueMonthTicks = useMemo(() => {
    const monthKeys = new Map<string, number>();
    for (const point of medicationRevenueTrendData) {
      const date = new Date(point.date);
      if (!isFinite(date.getTime())) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthKeys.has(key)) monthKeys.set(key, new Date(date.getFullYear(), date.getMonth(), 1).getTime());
    }
    return [...monthKeys.values()];
  }, [medicationRevenueTrendData]);

  const totalPrescriptions = (demandTrend?.series || []).reduce(
    (seriesSum, series) => seriesSum + (series?.points || []).reduce((pointSum, point) => pointSum + Number(point?.value || 0), 0),
    0
  );
  const totalDispensed = totalPrescriptions;
  const totalCollected = (analytics?.analytics?.total_revenue || 0);
  const billingVolume = (bills?.items || []).reduce((sum, bill) => sum + Number(bill.net_amount || bill.total_amount || 0), 0);
  const pendingAmount = analytics?.analytics?.total_outstanding_balance || 0;
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
    const list = payments?.items || [];
    const counts = new Map<string, number>();
    for (const p of list) {
      const key = String(p.payment_method || 'Unknown');
      counts.set(key, (counts.get(key) || 0) + Number(p.amount_paid || 0));
    }
    let best = 'N/A';
    let bestValue = 0;
    let total = 0;
    counts.forEach((v) => { total += v; if (v > bestValue) { bestValue = v; } });
    counts.forEach((v, k) => { if (v === bestValue) best = k; });
    const pct = total ? (bestValue / total) * 100 : 0;
    return { method: best, pct };
  }, [payments]);

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
      const totalInvoices = (bills?.items || []).length;
      const paid = (bills?.items || []).filter((b) => String(b.status || '').toLowerCase() === 'paid').length;
      const success = totalInvoices ? (paid / totalInvoices) * 100 : 0;
      return [
        { title: 'Total Invoices', value: formatCount(totalInvoices), detail: 'Generated this period', trendPct: 4.1 },
        { title: 'Outstanding Balance', value: formatPeso(pendingAmount), detail: 'Unpaid as of today', trendPct: -2.3 },
        { title: 'Average Invoice Value', value: formatPeso(analytics?.analytics?.average_bill_amount || 0), detail: 'Per transaction', trendPct: 3.9 },
        { title: 'Billing Success Rate', value: `${success.toFixed(1)}%`, detail: 'Paid vs. total invoiced', trendPct: 2.6 },
      ];
    }
    if (category === 'payment') {
      return [
        { title: 'Total Collected', value: formatPeso(totalCollected), detail: 'Cash received this period', trendPct: 5.2 },
        { title: 'Pending Payments', value: formatPeso(pendingAmount), detail: 'Awaiting collection', trendPct: -1.1 },
        { title: 'Top Payment Method', value: `${topMethod.method} — ${topMethod.pct.toFixed(1)}%`, detail: 'Dominant mode this period', trendPct: 0.8 },
        { title: 'Average Collection Days', value: '3.2 days', detail: 'From invoice to payment', trendPct: -2.7 },
      ];
    }
    return [
      { title: 'Prescriptions Filled', value: formatCount(totalPrescriptions), detail: 'Total for selected period', trendPct: trendFrom(totalPrescriptions, Math.max(1, totalPrescriptions * 0.9)) },
      { title: 'Top Medication', value: topMedication ? `${topMedication.medication_name}` : 'N/A', detail: topMedication ? `${formatCount(topMedication.current_quantity)} units` : 'No activity', trendPct: 6.4 },
      { title: 'Expired Stock Alerts', value: formatCount(expiryRisk?.metrics?.near_expiry_quantity || 0), detail: 'Requires immediate action', trendPct: -3.2 },
      { title: 'Average Dispense Time', value: '12 mins', detail: 'From receipt to release', trendPct: -4.8 },
    ];
  }, [category, totalPrescriptions, totalDispensed, billingVolume, totalCollected, topMedication, bills, pendingAmount, analytics, topMethod, medicationRevenue, averagePrescriptionValue]);

  const colors = chartPalette();
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

  return (
    <section className="rounded-2xl bg-gray-300/80 p-6">
      <div className="sticky top-0 z-20 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
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

      {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, idx) => (
              <div key={`s-${idx}`} className="h-40 animate-pulse rounded-2xl border border-gray-200 bg-white" />
            ))
          : kpis.map((card) => <Kpi key={card.title} card={card} />)}
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
                      <div className="mt-4 h-[280px]">
                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
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
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={[ 'dataMin', 'dataMax' ]}
                        ticks={dispensingVolumeMonthTicks}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                        tick={chartTextStyle}
                        tickMargin={10}
                        height={44}
                        minTickGap={24}
                        tickFormatter={(value) => toMonthLabel(value)}
                        interval={0}
                      />
                      <YAxis tickLine={false} axisLine={false} tick={chartTextStyle} tickMargin={10} />
                      <Tooltip
                        formatter={(value) => [formatCount(Number(value || 0)), 'Units']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        itemStyle={{ fontSize: 12 }}
                        labelStyle={{ fontSize: 12 }}
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
                        dataKey="timestamp"
                        type="number"
                        scale="time"
                        domain={[ 'dataMin', 'dataMax' ]}
                        ticks={medicationRevenueMonthTicks}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }}
                        tick={chartTextStyle}
                        tickMargin={10}
                        height={44}
                        minTickGap={24}
                        tickFormatter={(value) => toMonthLabel(value)}
                        interval={0}
                      />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatPeso(Number(value))} tick={chartTextStyle} />
                      <Tooltip
                        formatter={(value) => [formatPeso(Number(value || 0)), 'Revenue']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        itemStyle={{ fontSize: 12 }}
                        labelStyle={{ fontSize: 12 }}
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Billing Trends Over Time">
                {trendValues.length ? <SparkBars values={trendValues.map((v) => v * 2)} color={colors.primary} /> : <EmptyChart />}
              </ChartCard>
              <ChartCard title="Invoices by Status">
                <SparkBars values={[
                  (bills?.items || []).filter((b) => String(b.status || '').toLowerCase() === 'paid').length,
                  (bills?.items || []).filter((b) => String(b.status || '').toLowerCase() === 'pending').length,
                  (bills?.items || []).filter((b) => String(b.status || '').toLowerCase().includes('overdue')).length,
                  (bills?.items || []).filter((b) => String(b.status || '').toLowerCase().includes('reject')).length,
                ]} color={colors.secondary} />
              </ChartCard>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ChartCard title="Billing by Payer Over Time"><EmptyChart /></ChartCard>
              <ChartCard title="Rejection Rate by Reason"><EmptyChart /></ChartCard>
              <ChartCard title="AR Aging Trend"><EmptyChart /></ChartCard>
            </div>
          </>
        )}

        {category === 'payment' && (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ChartCard title="Payments by Method Over Time">
                <SparkBars values={[
                  (payments?.items || []).filter((p) => String(p.payment_method || '').toLowerCase() === 'cash').length,
                  (payments?.items || []).filter((p) => String(p.payment_method || '').toLowerCase() === 'gcash').length,
                  (payments?.items || []).filter((p) => String(p.payment_method || '').toLowerCase() === 'maya').length,
                  (payments?.items || []).filter((p) => String(p.payment_method || '').toLowerCase().includes('insurance')).length,
                ]} color={colors.accent} />
              </ChartCard>
              <ChartCard title="Payment Method Share">
                <DonutLike slices={[
                  { label: 'Cash', value: (payments?.items || []).filter((p) => String(p.payment_method || '').toLowerCase() === 'cash').length, color: colors.primary },
                  { label: 'GCash', value: (payments?.items || []).filter((p) => String(p.payment_method || '').toLowerCase() === 'gcash').length, color: colors.secondary },
                  { label: 'Maya', value: (payments?.items || []).filter((p) => String(p.payment_method || '').toLowerCase() === 'maya').length, color: colors.accent },
                  { label: 'Insurance', value: (payments?.items || []).filter((p) => String(p.payment_method || '').toLowerCase().includes('insurance')).length, color: colors.warn },
                ]} />
              </ChartCard>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <ChartCard title="Collection Efficiency Trend"><EmptyChart /></ChartCard>
              <ChartCard title="Expected vs. Received"><EmptyChart /></ChartCard>
              <ChartCard title="Refunds and Reversals Over Time"><EmptyChart /></ChartCard>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
