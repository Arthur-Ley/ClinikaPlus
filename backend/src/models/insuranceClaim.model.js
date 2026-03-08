import { supabase } from "../lib/supabase.js";

const PATIENT_INSURANCE_TABLES = ["tbl_patient_insurance", "tbl_patient_insurances"];

function isTableMissingError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return message.includes("does not exist") || code === "42p01" || code === "pgrst205";
}

async function findBillById(billId) {
  const { data, error } = await supabase
    .from("tbl_bills")
    .select("bill_id, patient_id, total_amount, discount_amount, insurance_coverage, net_amount, status")
    .eq("bill_id", billId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findPatientInsuranceById(patientInsuranceId) {
  for (const tableName of PATIENT_INSURANCE_TABLES) {
    const { data, error } = await supabase
      .from(tableName)
      .select("patient_insurance_id, patient_id")
      .eq("patient_insurance_id", patientInsuranceId)
      .maybeSingle();

    if (error) {
      const message = String(error.message || "").toLowerCase();
      const code = String(error.code || "").toLowerCase();
      const tableMissing =
        message.includes("does not exist") || code === "42p01" || code === "pgrst205";

      if (tableMissing) {
        continue;
      }

      throw error;
    }

    if (data) return data;
  }

  return null;
}

async function findPatientByName(firstName, lastName) {
  const { data, error } = await supabase
    .from("tbl_patients")
    .select("patient_id, first_name, last_name")
    .ilike("first_name", firstName)
    .ilike("last_name", lastName)
    .limit(2);

  if (error) throw error;
  return data || [];
}

async function findPatientsByLastName(lastName) {
  const { data, error } = await supabase
    .from("tbl_patients")
    .select("patient_id, first_name, last_name")
    .ilike("last_name", lastName)
    .limit(50);

  if (error) throw error;
  return data || [];
}

async function findInsuranceProviderByName(providerName) {
  const { data, error } = await supabase
    .from("tbl_insurance_providers")
    .select("provider_id, provider_name")
    .ilike("provider_name", `%${providerName}%`)
    .limit(10);

  if (error) throw error;
  return data || [];
}

async function findPatientInsuranceByPatientAndPolicy(patientId, memberId, providerId = null) {
  for (const tableName of PATIENT_INSURANCE_TABLES) {
    let query = supabase
      .from(tableName)
      .select("patient_insurance_id, patient_id, provider_id, member_id")
      .eq("patient_id", patientId)
      .eq("member_id", memberId)
      .limit(2);

    if (providerId) {
      query = query.eq("provider_id", providerId);
    }

    const { data, error } = await query;
    if (error) {
      if (isTableMissingError(error)) continue;
      throw error;
    }

    if (data?.length) return data;
  }

  return [];
}

async function findLatestBillByPatientId(patientId) {
  const { data, error } = await supabase
    .from("tbl_bills")
    .select("bill_id, patient_id, total_amount, discount_amount, insurance_coverage, net_amount, status")
    .eq("patient_id", patientId)
    .order("bill_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function findBillsByPatientId(patientId) {
  const { data, error } = await supabase
    .from("tbl_bills")
    .select("bill_id, patient_id, total_amount, discount_amount, insurance_coverage, net_amount, status")
    .eq("patient_id", patientId)
    .order("bill_id", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function createInsuranceClaim(input) {
  const { data, error } = await supabase
    .from("tbl_insurance_claims")
    .insert({
      claim_code: input.claimCode,
      bill_id: input.billId,
      patient_insurance_id: input.patientInsuranceId,
      claimed_amount: input.claimedAmount,
      approved_amount: input.approvedAmount,
      claim_date: input.claimDate,
      status: input.status,
      remarks: input.remarks,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function createInsuranceClaimItems(claimId, items) {
  if (!items?.length) return [];

  const payload = items.map((item) => ({
    claim_id: claimId,
    bill_item_id: item.billItemId,
    amount: item.amount,
  }));

  const { data, error } = await supabase
    .from("tbl_insurance_claim_items")
    .insert(payload)
    .select("*");

  if (error) {
    if (isTableMissingError(error)) {
      return [];
    }
    throw error;
  }
  return data || [];
}

async function getInsuranceClaimById(claimId) {
  const { data: claim, error: claimError } = await supabase
    .from("tbl_insurance_claims")
    .select("*")
    .eq("claim_id", claimId)
    .maybeSingle();

  if (claimError) throw claimError;
  if (!claim) return null;

  const { data: items, error: itemError } = await supabase
    .from("tbl_insurance_claim_items")
    .select("*")
    .eq("claim_id", claimId)
    .order("claim_item_id", { ascending: true });

  if (itemError) {
    if (isTableMissingError(itemError)) {
      return {
        ...claim,
        items: [],
      };
    }
    throw itemError;
  }

  return {
    ...claim,
    items: items || [],
  };
}

async function getInsuranceClaimsByBillId(billId) {
  const { data, error } = await supabase
    .from("tbl_insurance_claims")
    .select("*")
    .eq("bill_id", billId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function getAllInsuranceClaims() {
  const { data: claims, error } = await supabase
    .from("tbl_insurance_claims")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!claims?.length) return [];

  const billIds = [...new Set(claims.map((claim) => claim.bill_id).filter(Boolean))];
  const patientInsuranceIds = [
    ...new Set(claims.map((claim) => claim.patient_insurance_id).filter(Boolean)),
  ];

  const billsById = new Map();
  if (billIds.length) {
    const { data: bills, error: billsError } = await supabase
      .from("tbl_bills")
      .select("bill_id, bill_code, patient_id")
      .in("bill_id", billIds);

    if (billsError) throw billsError;
    for (const bill of bills || []) {
      billsById.set(bill.bill_id, bill);
    }
  }

  const patientInsuranceById = new Map();
  for (const tableName of PATIENT_INSURANCE_TABLES) {
    if (!patientInsuranceIds.length) break;

    const { data: patientInsurances, error: insuranceError } = await supabase
      .from(tableName)
      .select("patient_insurance_id, patient_id, provider_id, member_id, coverage_type")
      .in("patient_insurance_id", patientInsuranceIds);

    if (insuranceError) {
      if (isTableMissingError(insuranceError)) continue;
      throw insuranceError;
    }

    for (const patientInsurance of patientInsurances || []) {
      patientInsuranceById.set(patientInsurance.patient_insurance_id, patientInsurance);
    }
    break;
  }

  const patientIdsFromBills = Array.from(billsById.values())
    .map((bill) => bill.patient_id)
    .filter(Boolean);
  const patientIdsFromInsurance = Array.from(patientInsuranceById.values())
    .map((insurance) => insurance.patient_id)
    .filter(Boolean);
  const patientIds = [...new Set([...patientIdsFromBills, ...patientIdsFromInsurance])];

  const patientsById = new Map();
  if (patientIds.length) {
    const { data: patients, error: patientsError } = await supabase
      .from("tbl_patients")
      .select("patient_id, first_name, last_name")
      .in("patient_id", patientIds);

    if (patientsError) throw patientsError;
    for (const patient of patients || []) {
      patientsById.set(patient.patient_id, patient);
    }
  }

  const providerIds = [
    ...new Set(Array.from(patientInsuranceById.values()).map((insurance) => insurance.provider_id).filter(Boolean)),
  ];

  const providersById = new Map();
  if (providerIds.length) {
    const { data: providers, error: providersError } = await supabase
      .from("tbl_insurance_providers")
      .select("provider_id, provider_name")
      .in("provider_id", providerIds);

    if (providersError) throw providersError;
    for (const provider of providers || []) {
      providersById.set(provider.provider_id, provider);
    }
  }

  return claims.map((claim) => {
    const bill = billsById.get(claim.bill_id);
    const patientInsurance = patientInsuranceById.get(claim.patient_insurance_id);
    const patientId = patientInsurance?.patient_id || bill?.patient_id;
    const patient = patientsById.get(patientId);
    const provider = providersById.get(patientInsurance?.provider_id);
    const firstName = String(patient?.first_name || "").trim();
    const lastName = String(patient?.last_name || "").trim();

    return {
      ...claim,
      bill_code: bill?.bill_code || null,
      patient_name: [firstName, lastName].filter(Boolean).join(" ") || null,
      insurance_provider: provider?.provider_name || null,
      policy_no: patientInsurance?.member_id || null,
      coverage_type: patientInsurance?.coverage_type || null,
    };
  });
}

async function listBillsForClaimOptions(patientId = null) {
  let query = supabase
    .from("tbl_bills")
    .select("bill_id, patient_id, total_amount, status")
    .order("bill_id", { ascending: false });

  if (patientId !== null && patientId !== undefined) {
    query = query.eq("patient_id", patientId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data || [];
}

async function listPatientInsurancesForClaimOptions(patientId = null) {
  for (const tableName of PATIENT_INSURANCE_TABLES) {
    let query = supabase
      .from(tableName)
      .select("*")
      .order("patient_insurance_id", { ascending: false });

    if (patientId !== null && patientId !== undefined) {
      query = query.eq("patient_id", patientId);
    }

    const { data, error } = await query;

    if (error) {
      const message = String(error.message || "").toLowerCase();
      const code = String(error.code || "").toLowerCase();
      const tableMissing =
        message.includes("does not exist") || code === "42p01" || code === "pgrst205";

      if (tableMissing) {
        continue;
      }

      throw error;
    }

    return data || [];
  }

  return [];
}

async function updateInsuranceClaimById(claimId, patch) {
  const { data, error } = await supabase
    .from("tbl_insurance_claims")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("claim_id", claimId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function updateBillInsuranceById(billId, patch) {
  const { data, error } = await supabase
    .from("tbl_bills")
    .update(patch)
    .eq("bill_id", billId)
    .select("bill_id, patient_id, total_amount, discount_amount, insurance_coverage, net_amount, status")
    .single();

  if (error) throw error;
  return data;
}

export {
  findBillById,
  findPatientInsuranceById,
  findPatientByName,
  findPatientsByLastName,
  findInsuranceProviderByName,
  findPatientInsuranceByPatientAndPolicy,
  findLatestBillByPatientId,
  findBillsByPatientId,
  createInsuranceClaim,
  createInsuranceClaimItems,
  getInsuranceClaimById,
  getInsuranceClaimsByBillId,
  getAllInsuranceClaims,
  listBillsForClaimOptions,
  listPatientInsurancesForClaimOptions,
  updateInsuranceClaimById,
  updateBillInsuranceById,
};
