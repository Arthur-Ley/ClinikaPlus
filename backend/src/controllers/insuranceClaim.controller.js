import {
  approveClaim,
  createClaim,
  getAllClaims,
  getClaimCreateOptions,
  getClaimById,
  getClaimsByBillId,
  payClaim,
  rejectClaim,
  submitClaim,
} from "../services/insuranceClaim.service.js";

function getStatusCode(err) {
  return Number.isInteger(err?.status) ? err.status : 500;
}

export async function createInsuranceClaimController(req, res, next) {
  try {
    const result = await createClaim(req.body);
    return res.status(201).json(result);
  } catch (err) {
    err.status = getStatusCode(err);
    return next(err);
  }
}

export async function submitInsuranceClaimController(req, res, next) {
  try {
    const result = await submitClaim(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    err.status = getStatusCode(err);
    return next(err);
  }
}

export async function approveInsuranceClaimController(req, res, next) {
  try {
    const result = await approveClaim(req.params.id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    err.status = getStatusCode(err);
    return next(err);
  }
}

export async function rejectInsuranceClaimController(req, res, next) {
  try {
    const result = await rejectClaim(req.params.id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    err.status = getStatusCode(err);
    return next(err);
  }
}

export async function payInsuranceClaimController(req, res, next) {
  try {
    const result = await payClaim(req.params.id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    err.status = getStatusCode(err);
    return next(err);
  }
}

export async function getInsuranceClaimByIdController(req, res, next) {
  try {
    const result = await getClaimById(req.params.id);
    return res.status(200).json(result);
  } catch (err) {
    err.status = getStatusCode(err);
    return next(err);
  }
}

export async function getInsuranceClaimsByBillIdController(req, res, next) {
  try {
    const result = await getClaimsByBillId(req.params.billId);
    return res.status(200).json(result);
  } catch (err) {
    err.status = getStatusCode(err);
    return next(err);
  }
}

export async function getAllInsuranceClaimsController(_req, res, next) {
  try {
    const result = await getAllClaims();
    return res.status(200).json(result);
  } catch (err) {
    err.status = getStatusCode(err);
    return next(err);
  }
}

export async function getClaimCreateOptionsController(req, res, next) {
  try {
    const result = await getClaimCreateOptions(req.query.patient_id);
    return res.status(200).json(result);
  } catch (err) {
    err.status = getStatusCode(err);
    return next(err);
  }
}
