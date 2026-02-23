import {
  createRestockRequestFlow,
  listRestockRequests,
  updateRestockRequestFlow,
} from "../services/restockRequestService.js";
import {
  validateCreateRestockRequestInput,
  validateUpdateRestockRequestInput,
} from "../models/restockRequestModel.js";

export async function getRestockRequests(_req, res) {
  const items = await listRestockRequests();
  return res.status(200).json({ items });
}

export async function createRestockRequest(req, res) {
  const validation = validateCreateRestockRequestInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  const created = await createRestockRequestFlow(validation.data);
  return res.status(201).json({ request: created });
}

export async function updateRestockRequest(req, res) {
  const requestId = Number(req.params.requestId);
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ error: "'requestId' must be a positive integer." });
  }

  const validation = validateUpdateRestockRequestInput(req.body);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  await updateRestockRequestFlow(requestId, validation.data);
  return res.status(200).json({ ok: true });
}
