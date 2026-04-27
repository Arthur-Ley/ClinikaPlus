const VALID_STATUSES = new Set(["all", "active", "inprogress", "resolved", "unresolved"]);

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value !== "string") return false;

  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseList(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => parseList(item));
  }

  return String(value)
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function parseNotificationFilters(query = {}) {
  const status = String(query.status || "all").trim().toLowerCase();

  return {
    domain: parseList(query.domain),
    severity: parseList(query.severity),
    unreadOnly: parseBoolean(query.unreadOnly),
    status: VALID_STATUSES.has(status) ? status : "all",
  };
}

export function validateNotificationId(notificationId) {
  const value = Number(notificationId);
  if (!Number.isInteger(value) || value <= 0) {
    return { ok: false, message: "'notificationId' must be a positive integer." };
  }

  return { ok: true, data: value };
}
