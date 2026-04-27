import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  loadNotificationFeed,
  loadNotificationSummary,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotification,
  type NotificationItem,
  type NotificationSummary,
} from '../services/notificationsApi.ts';

type NotificationFilter = 'all' | 'critical' | 'pharmacy' | 'billing' | 'system';
type HistoryView = 'active' | 'resolved';
type SeverityFilter = 'all' | 'critical' | 'warning' | 'info';
type ReadFilter = 'all' | 'unread' | 'seen';
type TimeFilter = 'all' | 'today' | '7d' | '30d';
type SortMode = 'priority' | 'newest' | 'oldest' | 'severity';

function isUnresolved(status: NotificationItem['status']) {
  return status === 'Active' || status === 'InProgress';
}

function isPharmacyDomain(domain: string | null | undefined) {
  const value = String(domain || '').toLowerCase();
  return value === 'inventory' || value === 'expiry' || value === 'restock';
}

function severityRank(severity: NotificationItem['severity']) {
  if (severity === 'Critical') return 0;
  if (severity === 'Warning') return 1;
  return 2;
}

function sortByPriority(items: NotificationItem[]) {
  return [...items].sort((left, right) => {
    const leftRank = severityRank(left.severity);
    const rightRank = severityRank(right.severity);
    if (leftRank !== rightRank) return leftRank - rightRank;

    if (left.is_read !== right.is_read) return left.is_read ? 1 : -1;

    const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
    return rightTime - leftTime;
  });
}

function sortByTime(items: NotificationItem[], newestFirst = true) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left.resolved_at || left.updated_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.resolved_at || right.updated_at || right.created_at || 0).getTime();
    return newestFirst ? rightTime - leftTime : leftTime - rightTime;
  });
}

function sortBySeverityOnly(items: NotificationItem[]) {
  return [...items].sort((left, right) => {
    const rankDiff = severityRank(left.severity) - severityRank(right.severity);
    if (rankDiff !== 0) return rankDiff;
    const leftTime = new Date(left.updated_at || left.created_at || 0).getTime();
    const rightTime = new Date(right.updated_at || right.created_at || 0).getTime();
    return rightTime - leftTime;
  });
}

function formatRelativeTime(value: string | null) {
  if (!value) return 'Just now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function severityBadgeClass(severity: NotificationItem['severity']) {
  if (severity === 'Critical') return 'border-red-200 bg-red-50 text-red-700';
  if (severity === 'Warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function inTimeRange(item: NotificationItem, timeFilter: TimeFilter) {
  if (timeFilter === 'all') return true;
  const reference = new Date(item.resolved_at || item.updated_at || item.created_at || 0);
  if (Number.isNaN(reference.getTime())) return false;

  const now = new Date();
  if (timeFilter === 'today') {
    return reference.getFullYear() === now.getFullYear()
      && reference.getMonth() === now.getMonth()
      && reference.getDate() === now.getDate();
  }

  const diffMs = now.getTime() - reference.getTime();
  const days = diffMs / (1000 * 60 * 60 * 24);
  if (timeFilter === '7d') return days <= 7;
  if (timeFilter === '30d') return days <= 30;
  return true;
}

function NotificationsPageSkeleton() {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-white p-4 animate-pulse">
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="h-7 w-44 rounded-full bg-gray-200" />
          <div className="h-7 w-40 rounded-full bg-gray-200" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <article key={row} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-16 rounded-full bg-gray-200" />
                  <div className="h-6 w-16 rounded-full bg-gray-200" />
                  <div className="h-3 w-16 rounded bg-gray-200" />
                </div>
                <div className="mt-3 h-5 w-4/5 rounded bg-gray-200" />
                <div className="mt-2 h-4 w-full rounded bg-gray-200" />
                <div className="mt-1 h-4 w-3/4 rounded bg-gray-200" />
                <div className="mt-4 flex gap-2">
                  <div className="h-8 w-28 rounded-lg bg-gray-200" />
                  <div className="h-8 w-32 rounded-lg bg-gray-200" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [summary, setSummary] = useState<NotificationSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');
  const [historyView, setHistoryView] = useState<HistoryView>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('priority');

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const [summaryResponse, feedResponse] = await Promise.all([
          loadNotificationSummary(),
          loadNotificationFeed(),
        ]);
        if (!mounted) return;
        setSummary(summaryResponse.summary);
        setItems(feedResponse.items || []);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function refresh() {
    const [summaryResponse, feedResponse] = await Promise.all([
      loadNotificationSummary(),
      loadNotificationFeed(),
    ]);
    setSummary(summaryResponse.summary);
    setItems(feedResponse.items || []);
  }

  async function handleMarkRead(item: NotificationItem) {
    if (item.is_read) return;
    setItems((prev) => prev.map((row) => (
      row.notification_id === item.notification_id ? { ...row, is_read: true, read_at: new Date().toISOString() } : row
    )));
    try {
      await markNotificationRead(item.notification_id);
    } catch {
      await refresh();
    }
  }

  async function handleAction(item: NotificationItem) {
    await handleMarkRead(item);
    const ref = item.action_ref?.trim();
    if (!ref) return;
    if (ref.startsWith('/')) {
      navigate(ref);
      return;
    }
    window.location.href = ref;
  }

  async function handleResolve(item: NotificationItem) {
    if (item.action_ref) {
      await handleAction(item);
      return;
    }
    await resolveNotification(item.notification_id);
    await refresh();
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    await refresh();
  }

  function resetAdvancedFilters() {
    setSearchQuery('');
    setSeverityFilter('all');
    setReadFilter('all');
    setTimeFilter('all');
    setSortMode('priority');
  }

  const filteredItems = useMemo(
    () => items.filter((item) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'critical') return item.severity === 'Critical' && isUnresolved(item.status);
      if (activeFilter === 'pharmacy') return isPharmacyDomain(item.domain);
      return String(item.domain || '').toLowerCase() === activeFilter;
    }),
    [activeFilter, items],
  );
  const advancedFilteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return filteredItems.filter((item) => {
      if (severityFilter !== 'all' && item.severity.toLowerCase() !== severityFilter) return false;
      if (readFilter === 'unread' && item.is_read) return false;
      if (readFilter === 'seen' && !item.is_read) return false;
      if (!inTimeRange(item, timeFilter)) return false;

      if (!query) return true;
      const haystack = [
        item.title,
        item.message,
        item.domain,
        item.type,
        item.source_entity_type,
        item.source_entity_id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [filteredItems, readFilter, searchQuery, severityFilter, timeFilter]);

  const unresolvedBase = useMemo(
    () => advancedFilteredItems.filter((item) => isUnresolved(item.status)),
    [advancedFilteredItems],
  );
  const resolvedBase = useMemo(
    () => advancedFilteredItems.filter((item) => item.status === 'Resolved'),
    [advancedFilteredItems],
  );

  const unresolved = useMemo(() => {
    if (sortMode === 'newest') return sortByTime(unresolvedBase, true);
    if (sortMode === 'oldest') return sortByTime(unresolvedBase, false);
    if (sortMode === 'severity') return sortBySeverityOnly(unresolvedBase);
    return sortByPriority(unresolvedBase);
  }, [sortMode, unresolvedBase]);

  const resolved = useMemo(() => {
    if (sortMode === 'oldest') return sortByTime(resolvedBase, false);
    if (sortMode === 'severity') return sortBySeverityOnly(resolvedBase);
    return sortByTime(resolvedBase, true);
  }, [resolvedBase, sortMode]);

  const chipCounts = useMemo(() => {
    const unresolvedItems = items.filter((item) => isUnresolved(item.status));
    return {
      all: unresolvedItems.length,
      critical: unresolvedItems.filter((item) => item.severity === 'Critical').length,
      pharmacy: unresolvedItems.filter((item) => isPharmacyDomain(item.domain)).length,
      billing: unresolvedItems.filter((item) => String(item.domain || '').toLowerCase() === 'billing').length,
      system: unresolvedItems.filter((item) => String(item.domain || '').toLowerCase() === 'system').length,
    };
  }, [items]);

  return (
    <div className="flex h-full min-h-0 flex-col pb-4">
      <section className="flex flex-1 min-h-0 flex-col rounded-2xl bg-gray-300/80 p-5 space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            {summary?.badgeCount ?? unresolved.length} actionable item(s) | {summary?.totalCount ?? items.length} total
          </p>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="rounded-lg border border-blue-200 px-3 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            Mark all as read
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(['all', 'critical', 'pharmacy', 'billing', 'system'] as NotificationFilter[]).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setActiveFilter(chip)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                activeFilter === chip
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {chip} ({chipCounts[chip]})
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-6">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search title, message, domain, entity"
            className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-300 md:col-span-2"
          />
          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as SeverityFilter)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">Severity: All</option>
            <option value="critical">Severity: Critical</option>
            <option value="warning">Severity: Warning</option>
            <option value="info">Severity: Info</option>
          </select>
          <select
            value={readFilter}
            onChange={(event) => setReadFilter(event.target.value as ReadFilter)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">Read: All</option>
            <option value="unread">Read: Unread</option>
            <option value="seen">Read: Seen</option>
          </select>
          <select
            value={timeFilter}
            onChange={(event) => setTimeFilter(event.target.value as TimeFilter)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">Time: All</option>
            <option value="today">Time: Today</option>
            <option value="7d">Time: Last 7 days</option>
            <option value="30d">Time: Last 30 days</option>
          </select>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="priority">Sort: Priority</option>
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="severity">Sort: Severity</option>
          </select>
        </div>
        <div className="mt-2">
          <button
            type="button"
            onClick={resetAdvancedFilters}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Clear advanced filters
          </button>
        </div>
      </div>

      {isLoading && <NotificationsPageSkeleton />}

      {!isLoading && (
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHistoryView('active')}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  historyView === 'active'
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Active notifications ({unresolved.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryView('resolved')}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  historyView === 'resolved'
                    ? 'border-slate-300 bg-slate-100 text-slate-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                Resolved history ({resolved.length})
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {historyView === 'active' && unresolved.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                No active notifications in this filter.
              </div>
            )}

            {historyView === 'active' && unresolved.length > 0 && (
              <div className="space-y-3">
                {unresolved.map((item) => (
                  <article key={item.notification_id} className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`rounded-full border px-2 py-1 font-semibold ${severityBadgeClass(item.severity)}`}>
                        {item.severity}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${item.is_read ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'}`}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${item.is_read ? 'bg-slate-500' : 'bg-blue-600'}`} />
                        {item.is_read ? 'Seen' : 'Unread'}
                      </span>
                      <span className="text-gray-500">{formatRelativeTime(item.updated_at || item.created_at)}</span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-gray-900">{item.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{item.message}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleAction(item)}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                      >
                        Open details
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolve(item)}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                      >
                        {item.action_ref ? 'Resolve in module' : 'Resolve'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {historyView === 'resolved' && resolved.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                No resolved history yet.
              </div>
            )}

            {historyView === 'resolved' && resolved.length > 0 && (
              <div className="space-y-3">
                {resolved.map((item) => (
                  <article key={item.notification_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`rounded-full border px-2 py-1 font-semibold ${severityBadgeClass(item.severity)}`}>
                        {item.severity}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        Resolved
                      </span>
                      <span className="text-gray-500">{formatRelativeTime(item.resolved_at || item.updated_at || item.created_at)}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-gray-800">{item.title}</p>
                    <p className="mt-1 text-sm text-gray-600">{item.message}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </section>
    </div>
  );
}
