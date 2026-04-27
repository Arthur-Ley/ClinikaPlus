import {
  listNotificationsForUser,
  getNotificationSummaryForUser,
  markNotificationRead,
  markAllNotificationsRead,
  resolveNotification,
} from "../services/notificationService.js";
import { parseNotificationFilters, validateNotificationId } from "../models/notificationModel.js";

function getActorId(req) {
  return req.user?.id || null;
}

export async function getNotifications(req, res) {
  const actorId = getActorId(req);
  const filters = parseNotificationFilters(req.query);
  const result = await listNotificationsForUser(actorId, filters);
  return res.status(200).json(result);
}

export async function getNotificationsSummary(req, res) {
  const actorId = getActorId(req);
  const result = await getNotificationSummaryForUser(actorId);
  return res.status(200).json(result);
}

export async function markNotificationAsRead(req, res) {
  const validation = validateNotificationId(req.params.notificationId);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  const actorId = getActorId(req);
  await markNotificationRead(validation.data, actorId);
  return res.status(200).json({ ok: true });
}

export async function markAllNotificationsAsRead(req, res) {
  const actorId = getActorId(req);
  const result = await markAllNotificationsRead(actorId);
  return res.status(200).json(result);
}

export async function resolveNotificationItem(req, res) {
  const validation = validateNotificationId(req.params.notificationId);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  const actorId = getActorId(req);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  const notification = await resolveNotification(validation.data, actorId, reason || null);
  return res.status(200).json({ ok: true, notification });
}
