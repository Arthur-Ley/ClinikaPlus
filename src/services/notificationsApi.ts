import { getAuthSession } from './authApi';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export type NotificationSeverity = 'Critical' | 'Warning' | 'Info';
export type NotificationStatus = 'Active' | 'InProgress' | 'Resolved';

export type NotificationItem = {
  notification_id: number;
  domain: string;
  type: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
  dedupe_key: string;
  status: NotificationStatus;
  action_taken: boolean;
  action_taken_at?: string | null;
  action_type: string | null;
  action_ref: string | null;
  target_path?: string | null;
  target_query?: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  is_read: boolean;
  read_at: string | null;
};

export type NotificationSummary = {
  badgeCount: number;
  unresolvedCount: number;
  unresolvedCriticalCount: number;
  unresolvedWarningCount: number;
  unresolvedReadCount: number;
  unreadCount: number;
  resolvedCount: number;
  totalCount: number;
  pharmacyBadgeCount?: number;
  byDomain?: {
    pharmacy: number;
    billing: number;
    system: number;
  };
};

export type NotificationFeedResponse = {
  items: NotificationItem[];
  summary: NotificationSummary;
};

export type NotificationQuery = {
  domain?: string[];
  severity?: string[];
  unreadOnly?: boolean;
  status?: 'all' | 'active' | 'inprogress' | 'resolved' | 'unresolved';
};

function getAccessToken() {
  return getAuthSession()?.accessToken || null;
}

function buildQueryString(filters?: NotificationQuery) {
  if (!filters) return '';

  const params = new URLSearchParams();
  if (filters.domain?.length) params.set('domain', filters.domain.join(','));
  if (filters.severity?.length) params.set('severity', filters.severity.join(','));
  if (filters.unreadOnly) params.set('unreadOnly', 'true');
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);

  const search = params.toString();
  return search ? `?${search}` : '';
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('Missing access token.');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers || {}),
    },
  });

  const json = (await response.json().catch(() => null)) as { error?: string } | null;

  if (!response.ok) {
    throw new Error(json?.error || `Notification request failed with status ${response.status}.`);
  }

  return json as T;
}

export async function loadNotificationFeed(filters?: NotificationQuery): Promise<NotificationFeedResponse> {
  return requestJson<NotificationFeedResponse>(`/notifications${buildQueryString(filters)}`, {
    method: 'GET',
  });
}

export async function loadNotificationSummary(): Promise<{ summary: NotificationSummary }> {
  return requestJson<{ summary: NotificationSummary }>('/notifications/summary', {
    method: 'GET',
  });
}

export async function markNotificationRead(notificationId: number): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(`/notifications/${notificationId}/read`, {
    method: 'POST',
  });
}

export async function markAllNotificationsRead(): Promise<{ ok: true; updatedCount: number }> {
  return requestJson<{ ok: true; updatedCount: number }>('/notifications/read-all', {
    method: 'POST',
  });
}

export async function resolveNotification(notificationId: number): Promise<{ ok: true }> {
  return requestJson<{ ok: true }>(`/notifications/${notificationId}/resolve`, {
    method: 'POST',
  });
}
