import { createSignedUploadUrl, listBuckets } from "../services/storageService.js";
import { validateSignedUploadInput } from "../models/storageModel.js";

export async function getBuckets(_req, res) {
  const buckets = await listBuckets();
  return res.status(200).json({ buckets });
}

export async function getSignedUploadUrl(req, res) {
  const validation = validateSignedUploadInput(req.body);

  if (!validation.ok) {
    return res.status(400).json({ error: validation.message });
  }

  const result = await createSignedUploadUrl(validation.data);
  return res.status(200).json(result);
}
