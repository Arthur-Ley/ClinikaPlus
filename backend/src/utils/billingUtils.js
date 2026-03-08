function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function roundCurrency(value) {
  return Number(toNumber(value, 0).toFixed(2));
}

function computeSubtotal(quantity, unitPrice) {
  const safeQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
  return roundCurrency(safeQuantity * toNumber(unitPrice, 0));
}

function computeBillTotals(items, discountAmount, insuranceCoverage, taxAmount = 0) {
  const totalAmount = roundCurrency(
    (items || []).reduce((sum, item) => sum + toNumber(item?.subtotal, 0), 0)
  );
  const netAmount = roundCurrency(
    totalAmount - toNumber(discountAmount, 0) - toNumber(insuranceCoverage, 0) + toNumber(taxAmount, 0)
  );

  return {
    total_amount: totalAmount,
    net_amount: netAmount,
  };
}

function isReferenceRequired(paymentMethod) {
  const normalized = typeof paymentMethod === "string" ? paymentMethod.trim().toLowerCase() : "";
  return normalized === "gcash" || normalized === "maya";
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function toNonNegativeNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return roundCurrency(parsed);
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildPagedResult(rows, page, pageSize, total) {
  return {
    items: rows,
    pagination: {
      page,
      limit: pageSize,
      page_size: pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export {
  buildPagedResult,
  computeBillTotals,
  computeSubtotal,
  isReferenceRequired,
  normalizeText,
  roundCurrency,
  toNonNegativeNumber,
  toPositiveInt,
};
