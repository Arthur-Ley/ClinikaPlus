import { useEffect, useMemo, useState, type ComponentType } from 'react';
import {
  ArrowLeftRight,
  CircleDollarSign,
  Coins,
  HandCoins,
  BarChart3,
  LineChart,
  PieChart,
  BarChartHorizontal,
} from 'lucide-react';

type RevenueCard = {
  title: string;
  value: string;
  chipClass: string;
  valueClass: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

type ChartPoint = {
  label: string;
  value: number;
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
  charts?: {
    revenue_by_month?: ChartPoint[];
    revenue_by_date?: ChartPoint[];
    revenue_by_method?: ChartPoint[];
    revenue_by_service?: ChartPoint[];
  };
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

function formatMoney(value: number) {
  return `PHP ${Math.round(value).toLocaleString()}`;
}

function getPointsForLine(data: ChartPoint[]) {
  if (data.length === 0) return '';
  const width = 420;
  const height = 160;
  const max = Math.max(...data.map((item) => item.value), 1);
  const step = data.length === 1 ? 0 : width / (data.length - 1);

  return data
    .map((item, idx) => {
      const x = step * idx;
      const y = height - (item.value / max) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');
}

function SummaryCard({ card }: { card: RevenueCard }) {
  const Icon = card.icon;
  return (
    <article className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
      <div className="flex items-start justify-between">
        <p className="text-3.5 font-semibold text-gray-500">{card.title}</p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-white ${card.chipClass}`}>
          <Icon size={14} />
        </span>
      </div>
      <p className={`mt-6 text-4xl font-bold ${card.valueClass}`}>{card.value}</p>
    </article>
  );
}

function RevenueOverTimeChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 p-3">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-800">Revenue Over Time</h3>
      </div>
      <div className="flex h-[140px] items-end gap-3">
        {data.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full max-w-[62px] rounded-t-md bg-blue-500/90"
              style={{ height: `${Math.max(14, (item.value / max) * 100)}px` }}
              title={`${item.label}: ${formatMoney(item.value)}`}
            />
            <p className="text-xs font-semibold text-gray-700">{item.label}</p>
            <p className="text-[11px] text-gray-600">{Math.round(item.value / 1000)}k</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-600">Source: backend-paid rows grouped by month.</p>
    </div>
  );
}

function DailyCollectionsChart({ data }: { data: ChartPoint[] }) {
  const points = getPointsForLine(data);
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 p-3">
      <div className="mb-3 flex items-center gap-2">
        <LineChart className="h-4 w-4 text-amber-600" />
        <h3 className="text-lg font-semibold text-gray-800">Daily Collections</h3>
      </div>

      <div className="relative h-[140px] rounded-xl border border-gray-200 bg-gray-50 p-2">
        {data.length > 1 && (
          <svg viewBox="0 0 420 160" className="h-full w-full">
            <polyline fill="none" stroke="#d97706" strokeWidth="3" points={points} />
            {points.split(' ').map((point) => {
              const [x, y] = point.split(',');
              return <circle key={point} cx={x} cy={y} r="4" fill="#b45309" />;
            })}
          </svg>
        )}
        {data.length <= 1 && <p className="p-2 text-xs text-gray-500">Not enough paid dates for a trend line.</p>}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {data.map((item) => (
          <span key={item.label} className="rounded-md bg-gray-200 px-2 py-0.5 text-[11px] text-gray-700">
            {item.label}: {Math.round((item.value / max) * 100)}%
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-gray-600">Source: backend-paid rows grouped by date.</p>
    </div>
  );
}

function PaymentMethodChart({ data }: { data: ChartPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const palette = ['bg-blue-600', 'bg-green-500', 'bg-amber-500', 'bg-sky-500'];

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 p-3">
      <div className="mb-3 flex items-center gap-2">
        <PieChart className="h-4 w-4 text-green-600" />
        <h3 className="text-lg font-semibold text-gray-800">Payment Method Distribution</h3>
      </div>

      <div className="h-5 w-full overflow-hidden rounded-full bg-gray-200">
        {data.map((item, idx) => {
          const width = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div
              key={item.label}
              className={`inline-block h-full ${palette[idx % palette.length]}`}
              style={{ width: `${width}%` }}
              title={`${item.label}: ${formatMoney(item.value)}`}
            />
          );
        })}
      </div>

      <div className="mt-3 space-y-1.5">
        {data.map((item, idx) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <span className={`h-2.5 w-2.5 rounded-full ${palette[idx % palette.length]}`} />
              <span>{item.label}</span>
            </div>
            <span className="font-semibold text-gray-800">
              {formatMoney(item.value)} ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-600">Source: backend payments grouped by method.</p>
    </div>
  );
}

function RevenueByServiceChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 p-3">
      <div className="mb-3 flex items-center gap-2">
        <BarChartHorizontal className="h-4 w-4 text-purple-600" />
        <h3 className="text-lg font-semibold text-gray-800">Revenue by Service</h3>
      </div>

      <div className="space-y-2.5">
        {data.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between text-sm text-gray-700">
              <span>{item.label}</span>
              <span className="font-semibold text-gray-800">{formatMoney(item.value)}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-600">Source: backend paid bill items grouped by labeled service or medication.</p>
    </div>
  );
}

function RevenueReportsSkeleton() {
  return (
    <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 rounded bg-gray-300" />
        <div className="h-9 w-28 rounded-xl bg-gray-300" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <article key={item} className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="flex items-start justify-between">
              <div className="h-5 w-28 rounded bg-gray-300" />
              <div className="h-8 w-8 rounded-xl bg-gray-300" />
            </div>
            <div className="mt-8 h-10 w-32 rounded bg-gray-300" />
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-gray-300" />
              <div className="h-5 w-40 rounded bg-gray-300" />
            </div>
            <div className="h-[180px] rounded-xl bg-gray-200" />
            <div className="mt-3 h-3 w-48 rounded bg-gray-300" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function RevenueReports() {
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);
  const [charts, setCharts] = useState({
    revenue_by_month: [] as ChartPoint[],
    revenue_by_date: [] as ChartPoint[],
    revenue_by_method: [] as ChartPoint[],
    revenue_by_service: [] as ChartPoint[],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/billing/reports/overview`);
        if (!response.ok) throw new Error('Failed to load billing reports.');

        const payload = (await response.json()) as BillingReportsOverviewResponse;
        if (!active) return;

        setAnalytics(payload.analytics || null);
        setCharts({
          revenue_by_month: payload.charts?.revenue_by_month || [],
          revenue_by_date: payload.charts?.revenue_by_date || [],
          revenue_by_method: payload.charts?.revenue_by_method || [],
          revenue_by_service: payload.charts?.revenue_by_service || [],
        });
      } catch {
        if (!active) return;
        setAnalytics(null);
        setCharts({
          revenue_by_month: [],
          revenue_by_date: [],
          revenue_by_method: [],
          revenue_by_service: [],
        });
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo<RevenueCard[]>(() => {
    const totalRevenue = analytics?.total_revenue ?? 0;
    const outstanding = analytics?.total_outstanding_balance ?? 0;
    const avgPayment = analytics?.average_bill_amount ?? 0;
    const totalTransactions = analytics?.total_transactions ?? ((analytics?.total_paid_bills ?? 0) + (analytics?.total_pending_bills ?? 0));

    return [
      {
        title: 'Total Revenue',
        value: formatMoney(totalRevenue),
        chipClass: 'bg-green-500',
        valueClass: 'text-gray-800',
        icon: CircleDollarSign,
      },
      {
        title: 'Total Transactions',
        value: String(totalTransactions),
        chipClass: 'bg-blue-600',
        valueClass: 'text-gray-800',
        icon: ArrowLeftRight,
      },
      {
        title: 'Outstanding',
        value: formatMoney(outstanding),
        chipClass: 'bg-amber-500',
        valueClass: 'text-gray-800',
        icon: HandCoins,
      },
      {
        title: 'Average Payment',
        value: formatMoney(avgPayment),
        chipClass: 'bg-blue-500',
        valueClass: 'text-gray-800',
        icon: Coins,
      },
    ];
  }, [analytics]);

  return (
    <div className="space-y-5">
      {isLoading ? (
        <RevenueReportsSkeleton />
      ) : (
        <section className="rounded-2xl bg-gray-300/80 p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <SummaryCard key={card.title} card={card} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <RevenueOverTimeChart data={charts.revenue_by_month} />
            <DailyCollectionsChart data={charts.revenue_by_date} />
            <PaymentMethodChart data={charts.revenue_by_method} />
            <RevenueByServiceChart data={charts.revenue_by_service} />
          </div>
        </section>
      )}
    </div>
  );
}
