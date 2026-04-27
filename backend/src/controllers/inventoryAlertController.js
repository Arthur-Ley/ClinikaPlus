import { resolveInventoryAlert, syncAndListInventoryAlerts } from "../services/inventoryAlertService.js";

export async function getInventoryAlerts(_req, res) {
  const items = await syncAndListInventoryAlerts();
  return res.status(200).json({ items });
}

export async function markInventoryAlertResolved(req, res) {
  const alertId = Number(req.params.alertId);
  if (!Number.isInteger(alertId) || alertId <= 0) {
    return res.status(400).json({ error: "'alertId' must be a positive integer." });
  }

  await resolveInventoryAlert(alertId, req.user?.id || null);
  return res.status(200).json({ ok: true });
}
