import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, Package2, X } from 'lucide-react';
import type { NotificationItem, NotificationSummary, NotificationSeverity } from '../../services/notificationsApi.ts';

type NotificationFilter = 'all' | 'critical' | 'pharmacy' | 'billing' | 'system';

type NotificationPanelProps = {
  items: NotificationItem[];
  summary: NotificationSummary | null;
  isLoading: boolean;
  onClose: () => void;
  onMarkRead: (item: NotificationItem) => void;
  onResolve: (item: NotificationItem) => void;
  onAction: (item: NotificationItem) => void;
  onMarkAllRead: () => void;
  onViewAll: () => void;
};

function isUnresolved(status: NotificationItem['status']) {
  return status === 'Active' || status === 'InProgress';
}

function isPharmacyDomain(domain: string | null | undefined) {
  const value = String(domain || '').toLowerCase();
  return value === 'inventory' || value === 'expiry' || value === 'restock';
}

function severityRank(severity: NotificationSeverity) {
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

function actionLabelFromType(value: string | null) {
  if (value === 'resolve') return 'Resolve';
  if (value === 'review') return 'Open details';
  if (!value) return 'Take action';
  return value.charAt(0).toUpperCase() + value.slice(1);
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

function extractRequestCode(item: NotificationItem) {
  const fromMessage = item.message.match(/RR-\d+/i)?.[0];
  if (fromMessage) return fromMessage.toUpperCase();
  const ref = item.action_ref || '';
  const queryPart = ref.split('?', 2)[1] || '';
  const params = new URLSearchParams(queryPart);
  const fromQuery = params.get('focusRequestCode');
  if (fromQuery) return fromQuery.toUpperCase();
  return null;
}

function extractMedicationKey(item: NotificationItem) {
  const ref = item.action_ref || '';
  const queryPart = ref.split('?', 2)[1] || '';
  const params = new URLSearchParams(queryPart);
  return params.get('focusMedicationId');
}

function buildContextLabel(item: NotificationItem) {
  const sourceType = String(item.source_entity_type || '').toLowerCase();
  if (!sourceType) return null;

  if (sourceType === 'restock_request') {
    const code = extractRequestCode(item);
    return code ? `Request Code: ${code}` : 'Restock request';
  }

  if (sourceType === 'batch') {
    return 'Batch';
  }

  if (sourceType === 'system') {
    return 'System';
  }

  return null;
}

function severityTone(severity: NotificationSeverity) {
  if (severity === 'Critical') return 'border-red-200 bg-red-50 text-red-700';
  if (severity === 'Warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-100 text-slate-600';
}

function severityIcon(severity: NotificationSeverity) {
  if (severity === 'Critical') return <AlertTriangle size={14} />;
  if (severity === 'Warning') return <Package2 size={14} />;
  return <CheckCircle2 size={14} />;
}

function NotificationSkeleton() {
  return (
    <div className="space-y-3 p-3">
      {[1, 2, 3].map((index) => (
        <div key={index} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-3 w-full animate-pulse rounded bg-gray-200" />
          <div className="mt-3 h-8 w-24 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
        active
          ? 'border-blue-300 bg-blue-50 text-blue-700'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      {label}
      <span className="rounded-full bg-white px-1.5 text-[10px] text-gray-500">{count}</span>
    </button>
  );
}

function NotificationCard({
  item,
  onMarkRead,
  onResolve,
  onAction,
}: {
  item: NotificationItem;
  onMarkRead: (item: NotificationItem) => void;
  onResolve: (item: NotificationItem) => void;
  onAction: (item: NotificationItem) => void;
}) {
  const isResolved = item.status === 'Resolved';
  const isUnread = !item.is_read && !isResolved;
  const canResolveInModule = Boolean(item.action_ref);
  const timeLabel = formatRelativeTime(item.resolved_at || item.updated_at || item.created_at);
  const contextLabel = buildContextLabel(item);

  return (
    <div
      className={`rounded-2xl border p-3 text-left transition ${
        isResolved
          ? 'border-gray-200 bg-gray-50'
          : isUnread
            ? 'border-blue-200 bg-white shadow-sm'
            : 'border-gray-200 bg-white'
      }`}
      onClick={() => {
        if (!item.is_read && !isResolved) onMarkRead(item);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (!item.is_read && !isResolved) onMarkRead(item);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${severityTone(item.severity)}`}>
              {severityIcon(item.severity)}
              {item.severity}
            </span>
            {isUnread && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-700">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-600" />
                Unread
              </span>
            )}
            {!isUnread && !isResolved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
                Seen
              </span>
            )}
            {isResolved && (
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                Resolved
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-semibold text-gray-900">{item.title}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600">{item.message}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={13} />
              {timeLabel}
            </span>
            {contextLabel ? <span>{contextLabel}</span> : null}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!isResolved) onAction(item);
          }}
          className={`inline-flex h-9 items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold transition ${
            isResolved
              ? 'cursor-default bg-gray-200 text-gray-500'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          disabled={isResolved}
        >
          {isResolved ? 'Resolved' : actionLabelFromType(item.action_type)}
          {!isResolved && item.action_ref ? <ExternalLink size={13} /> : null}
        </button>
        {!isResolved && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (canResolveInModule) {
                onAction(item);
                return;
              }
              onResolve(item);
            }}
            className="text-xs font-semibold text-gray-500 transition hover:text-gray-700"
          >
            {canResolveInModule ? 'Resolve in module' : 'Resolve'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function NotificationPanel({
  items,
  summary,
  isLoading,
  onClose,
  onMarkRead,
  onResolve,
  onAction,
  onMarkAllRead,
  onViewAll,
}: NotificationPanelProps) {
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>('all');

  const unresolvedItems = useMemo(
    () => items.filter((item) => isUnresolved(item.status)),
    [items],
  );

  const chipCounts = useMemo(() => {
    const unresolved = items.filter((item) => isUnresolved(item.status));
    return {
      all: unresolved.length,
      critical: unresolved.filter((item) => item.severity === 'Critical').length,
      pharmacy: unresolved.filter((item) => isPharmacyDomain(item.domain)).length,
      billing: unresolved.filter((item) => String(item.domain || '').toLowerCase() === 'billing').length,
      system: unresolved.filter((item) => String(item.domain || '').toLowerCase() === 'system').length,
    };
  }, [items]);

  const filteredItems = useMemo(
    () => items.filter((item) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'critical') return item.severity === 'Critical' && isUnresolved(item.status);
      if (activeFilter === 'pharmacy') return isPharmacyDomain(item.domain);
      return String(item.domain || '').toLowerCase() === activeFilter;
    }),
    [activeFilter, items],
  );

  const filteredUnresolved = filteredItems.filter((item) => isUnresolved(item.status));
  const filteredResolved = filteredItems.filter((item) => item.status === 'Resolved');

  const criticalUnresolvedItems = sortByPriority(
    filteredUnresolved.filter((item) => item.severity === 'Critical'),
  );
  const warningUnresolvedItems = sortByPriority(
    filteredUnresolved.filter((item) => item.severity === 'Warning' && !item.is_read),
  );
  const infoUnresolvedItems = sortByPriority(
    filteredUnresolved.filter((item) => item.severity === 'Info' && !item.is_read),
  );
  const readUnresolvedItems = sortByPriority(
    filteredUnresolved.filter((item) => item.is_read && item.severity !== 'Critical'),
  );

  return (
    <div className="absolute right-0 top-[calc(100%+10px)] z-50 flex h-[72vh] min-h-[420px] max-h-[680px] w-[440px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
            <p className="mt-0.5 text-xs text-gray-500">
              {summary?.badgeCount ?? unresolvedItems.length} actionable item(s) | {summary?.totalCount ?? items.length} total
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
            aria-label="Close notifications"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="All" count={chipCounts.all} active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} />
            <FilterChip label="Critical" count={chipCounts.critical} active={activeFilter === 'critical'} onClick={() => setActiveFilter('critical')} />
            <FilterChip label="Pharmacy" count={chipCounts.pharmacy} active={activeFilter === 'pharmacy'} onClick={() => setActiveFilter('pharmacy')} />
            <FilterChip label="Billing" count={chipCounts.billing} active={activeFilter === 'billing'} onClick={() => setActiveFilter('billing')} />
            <FilterChip label="System" count={chipCounts.system} active={activeFilter === 'system'} onClick={() => setActiveFilter('system')} />
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-blue-600 transition hover:text-blue-700"
            onClick={onMarkAllRead}
          >
            Mark all as read
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 p-3">
        {isLoading && <NotificationSkeleton />}

        {!isLoading && filteredItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center">
            <p className="text-sm font-semibold text-gray-900">No notifications in this view</p>
            <p className="mt-1 text-sm text-gray-500">Try another filter chip to see other items.</p>
          </div>
        )}

        {!isLoading && filteredItems.length > 0 && (
          <div className="space-y-3">
            {criticalUnresolvedItems.length > 0 && (
              <section className="space-y-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Needs Action Now</p>
                <div className="space-y-2">
                  {criticalUnresolvedItems.map((item) => (
                    <NotificationCard
                      key={item.notification_id}
                      item={item}
                      onMarkRead={onMarkRead}
                      onResolve={onResolve}
                      onAction={onAction}
                    />
                  ))}
                </div>
              </section>
            )}

            {warningUnresolvedItems.length > 0 && (
              <section className="space-y-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Warnings</p>
                <div className="space-y-2">
                  {warningUnresolvedItems.map((item) => (
                    <NotificationCard
                      key={item.notification_id}
                      item={item}
                      onMarkRead={onMarkRead}
                      onResolve={onResolve}
                      onAction={onAction}
                    />
                  ))}
                </div>
              </section>
            )}

            {infoUnresolvedItems.length > 0 && (
              <section className="space-y-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Info</p>
                <div className="space-y-2">
                  {infoUnresolvedItems.map((item) => (
                    <NotificationCard
                      key={item.notification_id}
                      item={item}
                      onMarkRead={onMarkRead}
                      onResolve={onResolve}
                      onAction={onAction}
                    />
                  ))}
                </div>
              </section>
            )}

            {readUnresolvedItems.length > 0 && (
              <section className="space-y-2">
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Read Unresolved</p>
                <div className="space-y-2">
                  {readUnresolvedItems.map((item) => (
                    <NotificationCard
                      key={item.notification_id}
                      item={item}
                      onMarkRead={onMarkRead}
                      onResolve={onResolve}
                      onAction={onAction}
                    />
                  ))}
                </div>
              </section>
            )}

            {filteredResolved.length > 0 && (
              <details className="rounded-2xl border border-gray-200 bg-white p-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-gray-800">
                  Resolved history ({filteredResolved.length})
                </summary>
                <div className="mt-3 space-y-2">
                  {filteredResolved.map((item) => (
                    <NotificationCard
                      key={item.notification_id}
                      item={item}
                      onMarkRead={onMarkRead}
                      onResolve={onResolve}
                      onAction={onAction}
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
      <div className="border-t border-gray-200 bg-white px-4 py-2">
        <button
          type="button"
          className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-700"
          onClick={onViewAll}
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}
