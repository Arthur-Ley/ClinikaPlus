import {
  createInsuranceClaim,
  createInsuranceClaimItems,
  findBillsByPatientId,
  findBillById,
  findInsuranceProviderByName,
  findPatientByName,
  findPatientsByLastName,
  findPatientInsuranceById,
  findPatientInsuranceByPatientAndPolicy,
  getAllInsuranceClaims,
  getInsuranceClaimById,
  getInsuranceClaimsByBillId,
  listBillsForClaimOptions,
  listPatientInsurancesForClaimOptions,
  updateBillInsuranceById,
  updateInsuranceClaimById,
} from "../models/insuranceClaim.model.js";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function toNonNegativeNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function toOptionalString(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function toStringArray(value) {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function normalizeClaimItems(items) {
  if (items === undefined || items === null) return [];
  if (!Array.isArray(items)) {
    throw new HttpError(400, "'items' must be an array when provided.");
  }

  return items.map((item, index) => {
    const billItemId = toPositiveInt(item?.bill_item_id);
    const amount = toPositiveNumber(item?.amount);

    if (!billItemId) {
      throw new HttpError(400, "'items[].bill_item_id' must be a positive integer.");
    }

    if (!amount) {
      throw new HttpError(400, "'items[].amount' must be a positive number.");
    }

    return {
      billItemId,
      amount,
      index,
    };
  });
}

function generateClaimCode() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `CLM-${yyyy}${mm}${dd}-${hh}${mi}${ss}-${rand}`;
}

function normalizeClaimPayload(payload) {
  const billId = toPositiveInt(payload?.bill_id);
  const patientInsuranceId = toPositiveInt(payload?.patient_insurance_id);
  const claimedAmount = toPositiveNumber(payload?.claimed_amount ?? payload?.claim_amount);
  const claimDate =
    toOptionalString(payload?.claim_date) ||
    toOptionalString(payload?.date_of_service) ||
    new Date().toISOString().slice(0, 10);
  const supportingDocuments = toStringArray(payload?.supporting_documents);
  const remarksParts = [
    toOptionalString(payload?.remarks),
    toOptionalString(payload?.diagnosis),
    toOptionalString(payload?.treatment_provided),
    supportingDocuments.length ? `Documents: ${supportingDocuments.join(", ")}` : null,
  ].filter(Boolean);
  const remarks = remarksParts.join(" | ") || null;
  const items = normalizeClaimItems(payload?.items);
  const patientName = toOptionalString(payload?.patient_name);
  const insuranceProvider = toOptionalString(payload?.insurance_provider);
  const policyNumber = toOptionalString(payload?.policy_number ?? payload?.member_id);

  if (!claimedAmount) {
    throw new HttpError(400, "'claimed_amount' (or 'claim_amount') must be a positive number.");
  }

  if ((billId && !patientInsuranceId) || (!billId && patientInsuranceId)) {
    throw new HttpError(400, "'bill_id' and 'patient_insurance_id' must be provided together.");
  }

  if (!billId && !patientInsuranceId) {
    if (!patientName) {
      throw new HttpError(400, "'patient_name' is required when IDs are not provided.");
    }
    if (!policyNumber) {
      throw new HttpError(400, "'policy_number' is required when IDs are not provided.");
    }
  }

  return {
    billId,
    patientInsuranceId,
    claimedAmount,
    claimDate,
    remarks,
    items,
    patientName,
    insuranceProvider,
    policyNumber,
    supportingDocuments,
  };
}

function splitPatientName(fullName) {
  const text = String(fullName || "").trim().replace(/\s+/g, " ");
  const parts = text.split(" ").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function normalizeNamePart(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function resolvePatientFromCandidates(candidates, fullName) {
  const normalizedFull = normalizeNamePart(fullName);
  const parts = normalizedFull.split(" ").filter(Boolean);
  if (parts.length < 2) return null;

  const inputFirst = parts[0];
  const inputLast = parts[parts.length - 1];

  const scored = candidates
    .map((patient) => {
      const first = normalizeNamePart(patient.first_name);
      const last = normalizeNamePart(patient.last_name);
      let score = 0;

      if (last === inputLast) score += 4;
      if (first === inputFirst) score += 3;
      if (first.startsWith(inputFirst) || inputFirst.startsWith(first)) score += 2;
      if (`${first} ${last}` === normalizedFull) score += 5;

      return { patient, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].patient;
}

function normalizeProviderName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function resolveProviderFromCandidates(candidates, providerName) {
  const target = normalizeProviderName(providerName);
  if (!target) return null;

  const scored = candidates
    .map((provider) => {
      const name = normalizeProviderName(provider.provider_name);
      let score = 0;
      if (name === target) score += 5;
      if (name.includes(target) || target.includes(name)) score += 3;
      return { provider, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null;
  return scored[0].provider;
}

async function validateBillAndInsurance(billId, patientInsuranceId) {
  const bill = await findBillById(billId);
  if (!bill) {
    throw new HttpError(404, `Bill ${billId} was not found.`);
  }

  const insurance = await findPatientInsuranceById(patientInsuranceId);
  if (!insurance) {
    throw new HttpError(404, `Patient insurance ${patientInsuranceId} was not found.`);
  }

  if (Number(insurance.patient_id) !== Number(bill.patient_id)) {
    throw new HttpError(400, "Patient insurance does not belong to the bill's patient.");
  }

  return { bill, insurance };
}

async function createClaim(data) {
  const input = normalizeClaimPayload(data);
  let billId = input.billId;
  let patientInsuranceId = input.patientInsuranceId;
  let bill;

  if (!billId || !patientInsuranceId) {
    const nameParts = splitPatientName(input.patientName);
    if (!nameParts) {
      throw new HttpError(400, "'patient_name' must include first and last name.");
    }

    let patient = null;
    const exactPatients = await findPatientByName(nameParts.firstName, nameParts.lastName);
    if (exactPatients.length === 1) {
      patient = exactPatients[0];
    } else if (exactPatients.length > 1) {
      throw new HttpError(409, `Multiple patients found for '${input.patientName}'. Please use a more specific name.`);
    }

    if (!patient) {
      const lastNameOnly = String(nameParts.lastName || "").trim().split(/\s+/).pop();
      const candidates = lastNameOnly ? await findPatientsByLastName(lastNameOnly) : [];
      patient = resolvePatientFromCandidates(candidates, input.patientName);
    }

    if (!patient) {
      throw new HttpError(404, `Patient '${input.patientName}' was not found.`);
    }

    let providerId = null;
    if (input.insuranceProvider) {
      const providers = await findInsuranceProviderByName(input.insuranceProvider);
      if (!providers.length) {
        throw new HttpError(404, `Insurance provider '${input.insuranceProvider}' was not found.`);
      }
      const provider = resolveProviderFromCandidates(providers, input.insuranceProvider);
      if (!provider) {
        throw new HttpError(409, `Multiple insurance providers matched '${input.insuranceProvider}'. Please be more specific.`);
      }
      providerId = provider.provider_id;
    }

    const insurances = await findPatientInsuranceByPatientAndPolicy(patient.patient_id, input.policyNumber, providerId);
    if (!insurances.length) {
      throw new HttpError(404, "Matching patient insurance was not found for this patient and policy number.");
    }
    if (insurances.length > 1) {
      throw new HttpError(409, "Multiple patient insurance matches found. Please use IDs.");
    }

    patientInsuranceId = insurances[0].patient_insurance_id;

    const bills = await findBillsByPatientId(patient.patient_id);
    if (!bills.length) {
      throw new HttpError(404, `No bill found for patient '${input.patientName}'.`);
    }

    const eligibleBill = bills.find((candidate) => Number(input.claimedAmount) <= Number(candidate.total_amount));
    if (!eligibleBill) {
      const maxBillTotal = Math.max(...bills.map((candidate) => Number(candidate.total_amount || 0)));
      throw new HttpError(
        400,
        `Claimed amount cannot exceed bill total amount. Highest available bill total is ${maxBillTotal}.`,
      );
    }

    bill = eligibleBill;
    billId = eligibleBill.bill_id;
  } else {
    const validated = await validateBillAndInsurance(billId, patientInsuranceId);
    bill = validated.bill;
  }

  if (Number(input.claimedAmount) > Number(bill.total_amount)) {
    throw new HttpError(400, "Claimed amount cannot exceed bill total amount.");
  }

  const createdClaim = await createInsuranceClaim({
    claimCode: generateClaimCode(),
    billId,
    patientInsuranceId,
    claimedAmount: input.claimedAmount,
    approvedAmount: null,
    claimDate: input.claimDate,
    status: "Pending",
    remarks: input.remarks,
  });

  const createdItems = await createInsuranceClaimItems(createdClaim.claim_id, input.items);

  return {
    ...createdClaim,
    items: createdItems,
  };
}

async function submitClaim(claimIdRaw) {
  const claimId = toPositiveInt(claimIdRaw);
  if (!claimId) {
    throw new HttpError(400, "'id' must be a positive integer.");
  }

  const claim = await getInsuranceClaimById(claimId);
  if (!claim) {
    throw new HttpError(404, `Claim ${claimId} was not found.`);
  }

  if (claim.status === "Approved" || claim.status === "Rejected") {
    throw new HttpError(409, `Claim cannot be submitted from '${claim.status}' status.`);
  }

  if (claim.status === "Submitted") {
    return claim;
  }

  return updateInsuranceClaimById(claimId, { status: "Submitted" });
}

async function approveClaim(claimIdRaw, payload) {
  const claimId = toPositiveInt(claimIdRaw);
  if (!claimId) {
    throw new HttpError(400, "'id' must be a positive integer.");
  }

  const approvedAmount = toNonNegativeNumber(payload?.approved_amount);
  const remarks = toOptionalString(payload?.remarks);

  if (approvedAmount === null) {
    throw new HttpError(400, "'approved_amount' must be a non-negative number.");
  }

  const claim = await getInsuranceClaimById(claimId);
  if (!claim) {
    throw new HttpError(404, `Claim ${claimId} was not found.`);
  }

  if (claim.status === "Approved") {
    throw new HttpError(409, "Claim is already approved.");
  }

  if (claim.status === "Rejected") {
    throw new HttpError(409, "Rejected claim cannot be approved.");
  }

  if (Number(approvedAmount) > Number(claim.claimed_amount)) {
    throw new HttpError(400, "Approved amount cannot exceed claimed amount.");
  }

  const updatedClaim = await updateInsuranceClaimById(claimId, {
    status: "Approved",
    approved_amount: approvedAmount,
    remarks,
  });

  const bill = await findBillById(claim.bill_id);
  if (!bill) {
    throw new HttpError(404, `Bill ${claim.bill_id} was not found.`);
  }

  const currentCoverage = Number(bill.insurance_coverage || 0);
  const discount = Number(bill.discount_amount || 0);
  const total = Number(bill.total_amount || 0);
  const nextCoverage = currentCoverage + Number(approvedAmount);
  const nextNet = Math.max(total - discount - nextCoverage, 0);

  await updateBillInsuranceById(bill.bill_id, {
    insurance_coverage: nextCoverage,
    net_amount: nextNet,
  });

  return updatedClaim;
}

async function rejectClaim(claimIdRaw, payload) {
  const claimId = toPositiveInt(claimIdRaw);
  if (!claimId) {
    throw new HttpError(400, "'id' must be a positive integer.");
  }

  const remarks = toOptionalString(payload?.remarks);

  const claim = await getInsuranceClaimById(claimId);
  if (!claim) {
    throw new HttpError(404, `Claim ${claimId} was not found.`);
  }

  if (claim.status === "Approved") {
    throw new HttpError(409, "Approved claim cannot be rejected.");
  }

  if (claim.status === "Rejected") {
    return claim;
  }

  return updateInsuranceClaimById(claimId, {
    status: "Rejected",
    approved_amount: 0,
    remarks,
  });
}

async function payClaim(claimIdRaw, payload) {
  const claimId = toPositiveInt(claimIdRaw);
  if (!claimId) {
    throw new HttpError(400, "'id' must be a positive integer.");
  }

  const remarks = toOptionalString(payload?.remarks);

  const claim = await getInsuranceClaimById(claimId);
  if (!claim) {
    throw new HttpError(404, `Claim ${claimId} was not found.`);
  }

  if (claim.status === "Paid") {
    return claim;
  }

  if (claim.status !== "Approved") {
    throw new HttpError(409, `Claim cannot be paid from '${claim.status}' status.`);
  }

  return updateInsuranceClaimById(claimId, {
    status: "Paid",
    remarks: remarks || claim.remarks || null,
  });
}

async function getClaimById(claimIdRaw) {
  const claimId = toPositiveInt(claimIdRaw);
  if (!claimId) {
    throw new HttpError(400, "'id' must be a positive integer.");
  }

  const claim = await getInsuranceClaimById(claimId);
  if (!claim) {
    throw new HttpError(404, `Claim ${claimId} was not found.`);
  }

  return claim;
}

async function getClaimsByBillId(billIdRaw) {
  const billId = toPositiveInt(billIdRaw);
  if (!billId) {
    throw new HttpError(400, "'billId' must be a positive integer.");
  }

  const bill = await findBillById(billId);
  if (!bill) {
    throw new HttpError(404, `Bill ${billId} was not found.`);
  }

  const claims = await getInsuranceClaimsByBillId(billId);
  return {
    bill_id: billId,
    claims,
  };
}

async function getAllClaims() {
  return getAllInsuranceClaims();
}

async function getClaimCreateOptions(patientIdRaw) {
  let patientId = null;

  if (patientIdRaw !== undefined && patientIdRaw !== null && String(patientIdRaw).trim() !== "") {
    patientId = toPositiveInt(patientIdRaw);
    if (!patientId) {
      throw new HttpError(400, "'patient_id' must be a positive integer when provided.");
    }
  }

  const [bills, patientInsurances] = await Promise.all([
    listBillsForClaimOptions(patientId),
    listPatientInsurancesForClaimOptions(patientId),
  ]);

  return {
    patient_id: patientId,
    bills,
    patient_insurances: patientInsurances,
  };
}

export {
  HttpError,
  createClaim,
  submitClaim,
  approveClaim,
  rejectClaim,
  payClaim,
  getClaimById,
  getAllClaims,
  getClaimCreateOptions,
  getClaimsByBillId,
};
