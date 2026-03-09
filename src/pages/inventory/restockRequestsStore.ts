export type RestockRequestSeverity = 'Critical' | 'Warning';
export type RestockRequestStatus = 'Pending' | 'Completed' | 'Cancelled';

export type StoredRestockRequest = {
  requestId: number;
  id: string;
  medicationId: string;
  medication: string;
  category: string;
  severity: RestockRequestSeverity;
  quantity: number;
  unit: string;
  currentStock: number;
  threshold: number;
  requestedOnIso: string;
  resolvedAtIso: string | null;
  supplierId: number;
  supplier: string;
  status: RestockRequestStatus;
  neededBy: string;
  notes: string;
};

type CreateRestockRequestInput = {
  medicationId: number;
  supplierId: number;
  medication: string;
  category: string;
  severity: RestockRequestSeverity;
  suggestedQuantity: number;
  quantity: number;
  unit: string;
  currentStock: number;
  threshold: number;
  neededBy: string;
  notes?: string;
};

type UpdateRestockRequestInput = {
  supplierId?: number;
  quantity?: number;
  status?: RestockRequestStatus;
  neededBy?: string;
  notes?: string;
};

type RestockApiItem = {
  request_id: number;
  request_code: string;
  medication_id: number;
  supplier_id: number;
  current_stock: number;
  suggested_quantity: number;
  requested_quantity: number;
  requested_on: string;
  resolved_on: string | null;
  resolved_at?: string | null;
  status: RestockRequestStatus;
  notes: string;
  medication_name: string;
  category_name: string;
  unit: string;
  reorder_threshold: number;
  supplier_name: string;
};

type RestockListApiResponse = {
  items: RestockApiItem[];
};

type RestockCreateApiResponse = {
  request: {
    request_id: number;
    request_code: string;
  };
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const NEEDED_BY_PREFIX = 'Needed By:';
export const RESTOCK_REQUESTS_CHANGED_EVENT = 'restock-requests-changed';
const GLOBAL_SEARCH_REFRESH_EVENT = 'global-search-refresh';
const inFlightCreateByMedication = new Map<number, Promise<StoredRestockRequest>>();

function parseNeededBy(notes: string) {
  const lines = notes.split('\n').map((line) => line.trim());
  const neededByLine = lines.find((line) => line.startsWith(NEEDED_BY_PREFIX));
  if (!neededByLine) return '';
  return neededByLine.slice(NEEDED_BY_PREFIX.length).trim();
}

function stripNeededBy(notes: string) {
  return notes
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => !line.startsWith(NEEDED_BY_PREFIX))
    .join('\n')
    .trim();
}

function buildNotes(neededBy: string, notes: string) {
  const base = notes.trim();
  if (!neededBy) return base;
  return `${NEEDED_BY_PREFIX} ${neededBy}${base ? `\n${base}` : ''}`;
}

function toSeverity(currentStock: number, status: RestockRequestStatus): RestockRequestSeverity {
  if (status === 'Pending' && currentStock <= 0) return 'Critical';
  return currentStock <= 0 ? 'Critical' : 'Warning';
}

function mapApiToStored(item: RestockApiItem): StoredRestockRequest {
  return {
    requestId: item.request_id,
    id: item.request_code,
    medicationId: `I-${String(item.medication_id).padStart(3, '0')}`,
    medication: item.medication_name,
    category: item.category_name,
    severity: toSeverity(item.current_stock, item.status),
    quantity: item.requested_quantity,
    unit: item.unit,
    currentStock: item.current_stock,
    threshold: item.reorder_threshold,
    requestedOnIso: item.requested_on,
    resolvedAtIso: item.resolved_on ?? item.resolved_at ?? null,
    supplierId: item.supplier_id,
    supplier: item.supplier_name || 'N/A',
    status: item.status,
    neededBy: parseNeededBy(item.notes || ''),
    notes: stripNeededBy(item.notes || ''),
  };
}

export async function loadRestockRequests(): Promise<StoredRestockRequest[]> {
  const response = await fetch(`${API_BASE_URL}/restock-requests`);
  if (!response.ok) {
    throw new Error('Failed to load restock requests.');
  }

  const json = (await response.json()) as RestockListApiResponse;
  return (json.items || []).map(mapApiToStored);
}

export async function createRestockRequest(input: CreateRestockRequestInput): Promise<StoredRestockRequest> {
  const existingInFlight = inFlightCreateByMedication.get(input.medicationId);
  if (existingInFlight) return existingInFlight;

  const createPromise = (async () => {
    const existingPending = (await loadRestockRequests()).find(
      (item) => item.medicationId === `I-${String(input.medicationId).padStart(3, '0')}` && item.status === 'Pending',
    );
    if (existingPending) return existingPending;

    const response = await fetch(`${API_BASE_URL}/restock-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        medication_id: input.medicationId,
        supplier_id: input.supplierId,
        current_stock: input.currentStock,
        suggested_quantity: input.suggestedQuantity,
        requested_quantity: input.quantity,
        requested_on: new Date().toISOString().slice(0, 10),
        notes: buildNotes(input.neededBy, input.notes || ''),
      }),
    });

    if (!response.ok) {
      const errorJson = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errorJson?.error || 'Failed to create restock request.');
    }

    const createJson = (await response.json()) as RestockCreateApiResponse;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(RESTOCK_REQUESTS_CHANGED_EVENT));
      window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_REFRESH_EVENT));
    }
    const items = await loadRestockRequests();
    const created = items.find((item) => item.requestId === createJson.request.request_id);
    if (!created) {
      throw new Error('Failed to load the newly created restock request.');
    }
    return created;
  })();

  inFlightCreateByMedication.set(input.medicationId, createPromise);
  try {
    return await createPromise;
  } finally {
    inFlightCreateByMedication.delete(input.medicationId);
  }
}

export async function updateRestockRequest(id: number, updates: UpdateRestockRequestInput): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/restock-requests/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      supplier_id: updates.supplierId,
      requested_quantity: updates.quantity,
      status: updates.status,
      notes: updates.notes !== undefined || updates.neededBy !== undefined
        ? buildNotes(updates.neededBy || '', updates.notes || '')
        : undefined,
    }),
  });

  if (!response.ok) {
    const errorJson = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(errorJson?.error || 'Failed to update restock request.');
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RESTOCK_REQUESTS_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(GLOBAL_SEARCH_REFRESH_EVENT));
  }
}
