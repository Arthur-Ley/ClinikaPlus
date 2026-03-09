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
import { useBillingPayments } from '../../context/useBillingPayments.ts';

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
  total_revenue: number;
  total_outstanding_balance: number;
  average_bill_amount: number;
};

type BillingAnalyticsResponse = {
  analytics?: BillingAnalytics;
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

function formatMoney(value: number) {
  return `PHP ${Math.round(value).toLocaleString()}`;
}

function formatMonthLabel(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-US', { month: 'short' });
}

function formatDayLabel(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function parseBillingAmount(total: string) {
  const parsed = Number(total.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
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
      <p className={`mt-8 text-5xl font-bold ${card.valueClass}`}>{card.value}</p>
    </article>
  );
}

function RevenueOverTimeChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-800">Revenue Over Time</h3>
      </div>
      <div className="flex h-[180px] items-end gap-3">
        {data.map((item) => (
          <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full max-w-[62px] rounded-t-md bg-blue-500/90"
              style={{ height: `${Math.max(16, (item.value / max) * 130)}px` }}
              title={`${item.label}: ${formatMoney(item.value)}`}
            />
            <p className="text-xs font-semibold text-gray-700">{item.label}</p>
            <p className="text-[11px] text-gray-600">{Math.round(item.value / 1000)}k</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-600">Source: paid rows grouped by month from payments data.</p>
    </div>
  );
}

function DailyCollectionsChart({ data }: { data: ChartPoint[] }) {
  const points = getPointsForLine(data);
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
      <div className="mb-3 flex items-center gap-2">
        <LineChart className="h-4 w-4 text-amber-600" />
        <h3 className="text-lg font-semibold text-gray-800">Daily Collections</h3>
      </div>

      <div className="relative h-[180px] rounded-xl border border-gray-200 bg-gray-50 p-2">
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
      <p className="mt-2 text-xs text-gray-600">Source: paid rows grouped by date from payments data.</p>
    </div>
  );
}

function PaymentMethodChart({ data }: { data: ChartPoint[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const palette = ['bg-blue-600', 'bg-green-500', 'bg-amber-500', 'bg-sky-500'];

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
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
      <p className="mt-3 text-xs text-gray-600">Source: paid rows grouped by payment method from payments data.</p>
    </div>
  );
}

function RevenueByServiceChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 p-4">
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
      <p className="mt-3 text-xs text-gray-600">
        Source: paid bill totals allocated across available service buckets because no direct service-level payment table exists.
      </p>
    </div>
  );
}

export default function RevenueReports() {
  const { paymentQueue, billingRecords } = useBillingPayments();
  const [analytics, setAnalytics] = useState<BillingAnalytics | null>(null);

  const paidPayments = useMemo(
    () => paymentQueue.filter((row) => row.status === 'Paid' && row.amount > 0),
    [paymentQueue],
  );

  const paidBills = useMemo(
    () => billingRecords.filter((row) => row.status === 'Paid' && parseBillingAmount(row.total) > 0),
    [billingRecords],
  );

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/billing/dashboard/analytics`);
        if (!response.ok) return;
        const payload = (await response.json()) as BillingAnalyticsResponse;
        if (!active || !payload.analytics) return;
        setAnalytics(payload.analytics);
      } catch {
        // Keep client-side computed fallback if analytics endpoint is unavailable.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const cards = useMemo<RevenueCard[]>(() => {
    const computedTotalRevenue = paidPayments.reduce((sum, row) => sum + row.amount, 0);
    const computedOutstanding = paymentQueue
      .filter((row) => row.status !== 'Paid')
      .reduce((sum, row) => sum + row.amount, 0);
    const computedAverage = paidPayments.length > 0 ? computedTotalRevenue / paidPayments.length : 0;

    const totalRevenue = analytics?.total_revenue ?? computedTotalRevenue;
    const outstanding = analytics?.total_outstanding_balance ?? computedOutstanding;
    const avgPayment = analytics?.average_bill_amount ?? computedAverage;
    const totalTransactions = analytics
      ? analytics.total_paid_bills + analytics.total_pending_bills
      : paymentQueue.length;

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
  }, [analytics, paymentQueue, paidPayments]);

  const revenueByMonth = useMemo<ChartPoint[]>(() => {
    const grouped = paidPayments.reduce<Record<string, number>>((acc, row) => {
      const key = row.date.slice(0, 7);
      acc[key] = (acc[key] || 0) + row.amount;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-4)
      .map(([month, value]) => ({
        label: formatMonthLabel(`${month}-01`),
        value,
      }));
  }, [paidPayments]);

  const revenueByDate = useMemo<ChartPoint[]>(() => {
    const grouped = paidPayments.reduce<Record<string, number>>((acc, row) => {
      acc[row.date] = (acc[row.date] || 0) + row.amount;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, value]) => ({
        label: formatDayLabel(date),
        value,
      }));
  }, [paidPayments]);

  const revenueByMethod = useMemo<ChartPoint[]>(() => {
    const grouped = paidPayments.reduce<Record<string, number>>((acc, row) => {
      const method = row.method === '-' ? 'Unspecified' : row.method;
      acc[method] = (acc[method] || 0) + row.amount;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, value]) => ({ label, value }));
  }, [paidPayments]);

  const revenueByService = useMemo<ChartPoint[]>(() => {
    const serviceBuckets = ['Consultation', 'Lab Test', 'X-Ray', 'Vaccination'];
    const seeded = serviceBuckets.reduce<Record<string, number>>((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});

    paidBills.forEach((bill, idx) => {
      const targetService = serviceBuckets[idx % serviceBuckets.length];
      seeded[targetService] += parseBillingAmount(bill.total);
    });

    return Object.entries(seeded)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [paidBills]);

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold tracking-tight text-gray-800">Reports & Insurance | Revenue Reports</h1>

      <section className="rounded-2xl bg-gray-300/80 p-5 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-4xl font-bold text-gray-800">Overview</h2>
          <span className="rounded-xl border border-gray-400 px-3 py-2 text-xs font-semibold text-gray-700">
            Total charts: 4
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <SummaryCard key={card.title} card={card} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <RevenueOverTimeChart data={revenueByMonth} />
          <DailyCollectionsChart data={revenueByDate} />
          <PaymentMethodChart data={revenueByMethod} />
          <RevenueByServiceChart data={revenueByService} />
        </div>
      </section>
    </div>
  );
}
