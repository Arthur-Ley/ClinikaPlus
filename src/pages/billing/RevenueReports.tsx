import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, LoaderCircle, TrendingUp } from 'lucide-react';

type FilterPreset = 'today' | 'this_week' | 'this_month' | 'custom';
type ScopeFilter = 'all' | 'single' | 'top5';
type BucketFilter = 'day' | 'week' | 'month';
type ReportType = 'all' | 'medication' | 'billing' | 'payment';

type MedicationOption = {
  medication_id: number;
  medication_name: string;
};

type SummaryResponse = {
  insights?: {
    stockout_alerts_next_7_days?: number;
    demand_spikes_wow?: number;
    expiry_value_at_risk?: number;
    top_medication_by_revenue?: { medication_id: number; medication_name: string; revenue: number } | null;
  };
};

type DemandTrendResponse = {
  series?: Array<{
    medication_id: number;
    medication_name: string;
    points: Array<{ key: string; label: string; value: number }>;
    moving_average?: number[];
  }>;
};

type TopMoversResponse = {
  rising?: Array<{ medication_id: number; medication_name: string; current_quantity: number; previous_quantity: number; growth_pct: number }>;
  falling?: Array<{ medication_id: number; medication_name: string; current_quantity: number; previous_quantity: number; growth_pct: number }>;
};

type RunwayResponse = {
  items?: Array<{
    medication_id: number;
    medication_name: string;
    current_stock: number;
    avg_daily_usage: number;
    days_left: number | null;
    risk: string;
    unit: string;
  }>;
};

type ExpiryRiskResponse = {
  metrics?: {
    near_expiry_quantity?: number;
    disposed_quantity?: number;
    at_risk_value?: number;
  };
  trend?: Array<{
    key: string;
    label: string;
    near_expiry_quantity: number;
    disposed_quantity: number;
  }>;
};

type RevenueMixResponse = {
  items?: Array<{
    medication_id: number;
    medication_name: string;
    revenue: number;
    share_pct: number;
    cumulative_pct: number;
  }>;
};

type UnitPriceTrendResponse = {
  medication?: { medication_id: number; medication_name: string } | null;
  points?: Array<{ key: string; label: string; average_unit_price: number }>;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

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

function formatMoney(value: number) {
  return `PHP ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatPct(value: number) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function riskPillClass(risk: string) {
  if (risk === 'High') return 'bg-rose-100 text-rose-700';
  if (risk === 'Medium') return 'bg-amber-100 text-amber-700';
  if (risk === 'Low') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-700';
}

export default function RevenueReports() {
  const [preset, setPreset] = useState<FilterPreset>('this_month');
  const [customStart, setCustomStart] = useState(getStartOfMonthInputValue());
  const [customEnd, setCustomEnd] = useState(getTodayInputValue());
  const [compareEnabled, setCompareEnabled] = useState(true);
  const [scope, setScope] = useState<ScopeFilter>('all');
  const [bucket, setBucket] = useState<BucketFilter>('day');
  const [selectedMedicationId, setSelectedMedicationId] = useState<number | ''>('');
  const [reportType, setReportType] = useState<ReportType>('all');

  const [medications, setMedications] = useState<MedicationOption[]>([]);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [demandTrend, setDemandTrend] = useState<DemandTrendResponse | null>(null);
  const [topMovers, setTopMovers] = useState<TopMoversResponse | null>(null);
  const [runway, setRunway] = useState<RunwayResponse | null>(null);
  const [expiryRisk, setExpiryRisk] = useState<ExpiryRiskResponse | null>(null);
  const [revenueMix, setRevenueMix] = useState<RevenueMixResponse | null>(null);
  const [unitPriceTrend, setUnitPriceTrend] = useState<UnitPriceTrendResponse | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const selectedRange = useMemo(() => buildRangeForPreset(preset, customStart, customEnd), [preset, customStart, customEnd]);

  const validationMessage = useMemo(() => {
    if (preset !== 'custom') return '';
    if (!customStart || !customEnd) return 'Select both dates for custom range.';
    if (customStart > customEnd) return 'Start date must be on or before end date.';
    return '';
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/medications`, { cache: 'no-store' });
        if (!response.ok) return;
        const payload = (await response.json()) as { items?: Array<{ medication_id: number; medication_name: string }> };
        if (!active || !Array.isArray(payload.items)) return;
        setMedications(payload.items.map((row) => ({ medication_id: row.medication_id, medication_name: row.medication_name })));
      } catch {
        // Best effort only.
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (validationMessage) return;
    let active = true;
    const controller = new AbortController();
    const hasData = Boolean(summary || demandTrend);

    async function loadReports() {
      setLoadError('');
      if (hasData) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const scopeValue = scope === 'single' && selectedMedicationId ? 'single' : scope;
        const params = new URLSearchParams({
          preset,
          start_date: selectedRange.startDate,
          end_date: selectedRange.endDate,
          scope: scopeValue,
          bucket,
          topN: '5',
          limit: '10',
        });
        if (scopeValue === 'single' && selectedMedicationId) {
          params.set('medicationId', String(selectedMedicationId));
        }

        const [summaryRes, trendRes, moversRes, runwayRes, expiryRes, mixRes, priceRes] = await Promise.all([
          fetch(`${API_BASE_URL}/billing/reports/summary?${params.toString()}`, { cache: 'no-store', signal: controller.signal }),
          fetch(`${API_BASE_URL}/billing/reports/medication-demand-trend?${params.toString()}`, { cache: 'no-store', signal: controller.signal }),
          fetch(`${API_BASE_URL}/billing/reports/top-movers?${params.toString()}`, { cache: 'no-store', signal: controller.signal }),
          fetch(`${API_BASE_URL}/billing/reports/inventory-runway?${params.toString()}`, { cache: 'no-store', signal: controller.signal }),
          fetch(`${API_BASE_URL}/billing/reports/expiry-risk?${params.toString()}`, { cache: 'no-store', signal: controller.signal }),
          fetch(`${API_BASE_URL}/billing/reports/revenue-mix?${params.toString()}`, { cache: 'no-store', signal: controller.signal }),
          fetch(`${API_BASE_URL}/billing/reports/unit-price-trend?${params.toString()}`, { cache: 'no-store', signal: controller.signal }),
        ]);

        if (!summaryRes.ok || !trendRes.ok || !moversRes.ok || !runwayRes.ok || !expiryRes.ok || !mixRes.ok || !priceRes.ok) {
          throw new Error('Failed to load revamped reports data.');
        }

        const [summaryPayload, trendPayload, moversPayload, runwayPayload, expiryPayload, mixPayload, pricePayload] = await Promise.all([
          summaryRes.json(),
          trendRes.json(),
          moversRes.json(),
          runwayRes.json(),
          expiryRes.json(),
          mixRes.json(),
          priceRes.json(),
        ]);

        if (!active) return;
        setSummary(summaryPayload as SummaryResponse);
        setDemandTrend(trendPayload as DemandTrendResponse);
        setTopMovers(moversPayload as TopMoversResponse);
        setRunway(runwayPayload as RunwayResponse);
        setExpiryRisk(expiryPayload as ExpiryRiskResponse);
        setRevenueMix(mixPayload as RevenueMixResponse);
        setUnitPriceTrend(pricePayload as UnitPriceTrendResponse);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load reports.');
      } finally {
        if (!active || controller.signal.aborted) return;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }

    loadReports();
    return () => {
      active = false;
      controller.abort();
    };
  }, [preset, selectedRange.startDate, selectedRange.endDate, validationMessage, scope, selectedMedicationId, bucket]);

  const demandSeries = demandTrend?.series || [];
  const trendLabels = demandSeries[0]?.points?.map((point) => point.label) || [];
  const topRevenueMedication = summary?.insights?.top_medication_by_revenue;
  const risingMovers = topMovers?.rising || [];
  const fallingMovers = topMovers?.falling || [];
  const runwayItems = runway?.items || [];
  const expiryTrend = expiryRisk?.trend || [];
  const mixItems = revenueMix?.items || [];
  const pricePoints = unitPriceTrend?.points || [];
  const showMedicationSections = reportType === 'all' || reportType === 'medication';
  const showBillingSections = reportType === 'all' || reportType === 'billing';
  const showPaymentSections = reportType === 'all' || reportType === 'payment';

  return (
    <section className="space-y-5 rounded-2xl bg-gray-300/80 p-5 font-sans">
      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              <CalendarRange className="h-4 w-4" />
              Reports Header
            </div>
            <p className="mt-2 text-2xl font-semibold text-slate-900">Medication Intelligence Reports</p>
            <p className="mt-1 text-sm text-slate-500">{selectedRange.startDate} - {selectedRange.endDate}</p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'medication', label: 'Medication' },
                { key: 'billing', label: 'Billing' },
                { key: 'payment', label: 'Payment' },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setReportType(chip.key as ReportType)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
                    reportType === chip.key
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: 'today', label: 'Today' },
                { key: 'this_week', label: 'This Week' },
                { key: 'this_month', label: 'This Month' },
                { key: 'custom', label: 'Custom Date Range' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setPreset(option.key as FilterPreset)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    preset === option.key ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" checked={compareEnabled} onChange={(e) => setCompareEnabled(e.target.checked)} />
                vs previous period
              </label>
              <select value={scope} onChange={(e) => setScope(e.target.value as ScopeFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="all">All meds</option>
                <option value="single">Single med</option>
                <option value="top5">Top 5</option>
              </select>
              <select value={bucket} onChange={(e) => setBucket(e.target.value as BucketFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
              <select
                value={selectedMedicationId}
                onChange={(e) => setSelectedMedicationId(e.target.value ? Number(e.target.value) : '')}
                disabled={scope !== 'single'}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="">Select medication</option>
                {medications.map((medication) => (
                  <option key={medication.medication_id} value={medication.medication_id}>
                    {medication.medication_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        {(isRefreshing || validationMessage) && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            {isRefreshing && (
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-sky-700">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Updating data
              </span>
            )}
            {validationMessage && <span className="text-rose-600">{validationMessage}</span>}
          </div>
        )}
      </div>

      {loadError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Loading reports...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(showMedicationSections || showBillingSections) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Stockout Alerts (7d)</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(summary?.insights?.stockout_alerts_next_7_days || 0)}</p>
              </div>
            )}
            {showMedicationSections && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Demand Spikes (WoW)</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{formatNumber(summary?.insights?.demand_spikes_wow || 0)}</p>
              </div>
            )}
            {showMedicationSections && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Expiry Value At Risk</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">{formatMoney(summary?.insights?.expiry_value_at_risk || 0)}</p>
              </div>
            )}
            {(showMedicationSections || showBillingSections) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Top Medication by Revenue</p>
              <p className="mt-2 text-xl font-bold text-slate-900">{topRevenueMedication?.medication_name || 'N/A'}</p>
              <p className="mt-1 text-sm text-slate-500">{topRevenueMedication ? formatMoney(topRevenueMedication.revenue) : 'No data'}</p>
              </div>
            )}
          </div>

          {showMedicationSections && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Medication Demand Trend</h3>
                <TrendingUp className="h-5 w-5 text-sky-600" />
              </div>
              {demandSeries.length === 0 ? (
                <p className="text-sm text-slate-500">No medication demand trend data in this range.</p>
              ) : (
                <div className="space-y-3 overflow-x-auto">
                  <div className="min-w-[680px] text-xs text-slate-400">{trendLabels.join(' • ')}</div>
                  {demandSeries.map((series) => {
                    const max = Math.max(...series.points.map((point) => point.value), 1);
                    return (
                      <div key={series.medication_id} className="rounded-xl border border-slate-200 p-3">
                        <p className="mb-2 text-sm font-semibold text-slate-800">{series.medication_name}</p>
                        <div className="flex items-end gap-1">
                          {series.points.map((point) => (
                            <div key={point.key} className="group flex flex-1 flex-col items-center">
                              <div
                                className="w-full rounded-t bg-gradient-to-t from-blue-600 to-sky-400"
                                style={{ height: `${Math.max(8, (point.value / max) * 80)}px` }}
                                title={`${point.label}: ${point.value}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Top Movers</h3>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-600">Rising</p>
              <div className="space-y-2">
                {risingMovers.slice(0, 5).map((row) => (
                  <div key={`rise-${row.medication_id}`} className="rounded-xl border border-emerald-100 bg-emerald-50 p-2">
                    <p className="text-sm font-semibold text-slate-800">{row.medication_name}</p>
                    <p className="text-xs text-slate-600">{formatPct(row.growth_pct)} • {formatNumber(row.current_quantity)} vs {formatNumber(row.previous_quantity)}</p>
                  </div>
                ))}
              </div>
              <p className="mb-2 mt-4 text-xs uppercase tracking-[0.2em] text-rose-600">Falling</p>
              <div className="space-y-2">
                {fallingMovers.slice(0, 5).map((row) => (
                  <div key={`fall-${row.medication_id}`} className="rounded-xl border border-rose-100 bg-rose-50 p-2">
                    <p className="text-sm font-semibold text-slate-800">{row.medication_name}</p>
                    <p className="text-xs text-slate-600">{formatPct(row.growth_pct)} • {formatNumber(row.current_quantity)} vs {formatNumber(row.previous_quantity)}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
          )}

          {showMedicationSections && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Inventory Runway Table</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.14em] text-slate-500">
                      <th className="py-2">Medication</th>
                      <th className="py-2">Stock</th>
                      <th className="py-2">Avg/Day</th>
                      <th className="py-2">Days Left</th>
                      <th className="py-2">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runwayItems.slice(0, 10).map((row) => (
                      <tr key={row.medication_id} className="border-b border-slate-100">
                        <td className="py-2 font-semibold text-slate-800">{row.medication_name}</td>
                        <td className="py-2 text-slate-700">{formatNumber(row.current_stock)} {row.unit}</td>
                        <td className="py-2 text-slate-700">{row.avg_daily_usage.toFixed(2)}</td>
                        <td className="py-2 text-slate-700">{row.days_left == null ? 'N/A' : row.days_left.toFixed(1)}</td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${riskPillClass(row.risk)}`}>{row.risk}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Expiry & Wastage Trend</h3>
              <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Near-expiry Qty</p>
                  <p className="text-lg font-semibold text-slate-900">{formatNumber(expiryRisk?.metrics?.near_expiry_quantity || 0)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">Disposed Qty</p>
                  <p className="text-lg font-semibold text-slate-900">{formatNumber(expiryRisk?.metrics?.disposed_quantity || 0)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs uppercase text-slate-500">At-risk Value</p>
                  <p className="text-lg font-semibold text-slate-900">{formatMoney(expiryRisk?.metrics?.at_risk_value || 0)}</p>
                </div>
              </div>
              <div className="space-y-2">
                {expiryTrend.slice(-8).map((point) => (
                  <div key={point.key} className="rounded-xl border border-slate-200 p-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{point.label}</span>
                      <span>Near-expiry {formatNumber(point.near_expiry_quantity)} • Disposed {formatNumber(point.disposed_quantity)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="h-2 rounded bg-amber-200" style={{ width: `${Math.min(100, point.near_expiry_quantity)}%` }} />
                      <div className="h-2 rounded bg-rose-300" style={{ width: `${Math.min(100, point.disposed_quantity)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
          )}

          {(showBillingSections || showPaymentSections || showMedicationSections) && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            {(showBillingSections || showMedicationSections) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Medication Revenue Mix</h3>
              <div className="space-y-2">
                {mixItems.slice(0, 12).map((item) => (
                  <div key={item.medication_id} className="rounded-xl border border-slate-200 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.medication_name}</p>
                      <p className="text-sm font-semibold text-slate-700">{formatMoney(item.revenue)}</p>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Share {item.share_pct.toFixed(1)}% • Cumulative {item.cumulative_pct.toFixed(1)}%</div>
                    <div className="mt-2 h-2 rounded bg-slate-100">
                      <div className="h-2 rounded bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${Math.min(100, item.share_pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
            )}

            {(showMedicationSections || showBillingSections) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-1 text-lg font-semibold text-slate-900">Unit Price Trend</h3>
              <p className="mb-3 text-sm text-slate-500">{unitPriceTrend?.medication?.medication_name || 'No medication selected from trend data'}</p>
              {pricePoints.length === 0 ? (
                <p className="text-sm text-slate-500">No unit price points in this range.</p>
              ) : (
                <div className="space-y-2">
                  {pricePoints.map((point) => (
                    <div key={point.key} className="rounded-xl border border-slate-200 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-slate-700">{point.label}</p>
                        <p className="text-sm font-semibold text-slate-800">{formatMoney(point.average_unit_price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            )}
          </div>
          )}

          {showPaymentSections && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 text-lg font-semibold text-slate-900">Payment View</h3>
              <p className="text-sm text-slate-600">Payment analytics currently uses the same billing dataset in this range. Add payment-method endpoint segmentation next for deeper payment-only reporting.</p>
            </section>
          )}
        </>
      )}
    </section>
  );
}
