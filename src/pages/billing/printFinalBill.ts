type GenericRow = Record<string, unknown>;

type FinalBillPrintInput = {
  bill: GenericRow;
  items: GenericRow[];
};

const CLINIC_LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <circle cx="48" cy="48" r="44" fill="#ffffff" stroke="#0f4c81" stroke-width="4" />
    <circle cx="48" cy="48" r="36" fill="#e8f1f8" stroke="#0f4c81" stroke-width="2" />
    <rect x="42" y="26" width="12" height="44" rx="2" fill="#0f4c81" />
    <rect x="26" y="42" width="44" height="12" rx="2" fill="#0f4c81" />
    <text x="48" y="84" font-size="10" font-family="Arial, sans-serif" text-anchor="middle" fill="#0f4c81">MMC</text>
  </svg>`,
)}`;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPeso(value: number) {
  return `\u20b1${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateTimeNoTimezoneShift(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return '';

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
  if (match) {
    const [, y, m, d, hh, mm] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }

  const fallback = new Date(raw);
  if (Number.isNaN(fallback.getTime())) return raw;
  return fallback.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function resolvePatientRow(bill: GenericRow) {
  const relation = Array.isArray(bill.tbl_patients) ? bill.tbl_patients[0] : bill.tbl_patients;
  return relation && typeof relation === 'object' ? (relation as GenericRow) : null;
}

function resolvePatientName(patient: GenericRow | null, patientId: unknown) {
  if (!patient) return toNumber(patientId) > 0 ? `Patient #${toNumber(patientId)}` : '';

  const fullNameCandidates = [patient.full_name, patient.patient_name, patient.name];
  for (const candidate of fullNameCandidates) {
    const text = normalizeText(candidate);
    if (text) return text;
  }

  const combined = [patient.first_name, patient.middle_name, patient.last_name]
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(' ')
    .trim();

  return combined || (toNumber(patientId) > 0 ? `Patient #${toNumber(patientId)}` : '');
}

function classifyServiceType(item: GenericRow) {
  if (toNumber(item.medication_id) > 0 || toNumber(item.log_id) > 0) return 'Medications';

  const serviceType = normalizeText(item.service_type).toLowerCase();
  if (serviceType.includes('room')) return 'Room Charge';
  if (serviceType.includes('lab') || serviceType.includes('laboratory') || serviceType.includes('x-ray') || serviceType.includes('xray')) return 'Laboratory';
  if (serviceType.includes('professional') || serviceType.includes('consult')) return 'Professional Fee';
  if (serviceType.includes('misc')) return 'Miscellaneous';

  const description = normalizeText(item.description).toLowerCase();
  if (description.includes('room')) return 'Room Charge';
  if (description.includes('lab') || description.includes('laboratory') || description.includes('x-ray') || description.includes('xray') || description.includes('blood') || description.includes('urinalysis')) return 'Laboratory';
  if (description.includes('professional') || description.includes('consult') || description.includes('doctor')) return 'Professional Fee';
  return 'Miscellaneous';
}

function buildSectionTotals(bill: GenericRow, items: GenericRow[]) {
  const grouped = {
    medications: 0,
    laboratory: 0,
    miscellaneous: 0,
    roomCharge: 0,
    professionalFee: 0,
  };

  for (const item of items) {
    const subtotal = toNumber(item.subtotal);
    if (subtotal <= 0) continue;
    const type = classifyServiceType(item);
    if (type === 'Medications') grouped.medications += subtotal;
    else if (type === 'Laboratory') grouped.laboratory += subtotal;
    else if (type === 'Miscellaneous') grouped.miscellaneous += subtotal;
    else if (type === 'Room Charge') grouped.roomCharge += subtotal;
    else if (type === 'Professional Fee') grouped.professionalFee += subtotal;
  }

  if (grouped.medications <= 0) grouped.medications = toNumber(bill.subtotal_medications);
  if (grouped.laboratory <= 0) grouped.laboratory = toNumber(bill.subtotal_laboratory);
  if (grouped.miscellaneous <= 0) grouped.miscellaneous = toNumber(bill.subtotal_miscellaneous);
  if (grouped.roomCharge <= 0) grouped.roomCharge = toNumber(bill.subtotal_room_charge);
  if (grouped.professionalFee <= 0) grouped.professionalFee = toNumber(bill.subtotal_professional_fee);

  grouped.medications = Math.max(0, grouped.medications);
  grouped.laboratory = Math.max(0, grouped.laboratory);
  grouped.miscellaneous = Math.max(0, grouped.miscellaneous);
  grouped.roomCharge = Math.max(0, grouped.roomCharge);
  grouped.professionalFee = Math.max(0, grouped.professionalFee);

  return grouped;
}

function breakdownRowsHtml(label: string, amount: number) {
  return `
    <div class="amount-row">
      <span class="left-label">${escapeHtml(label)}</span>
      <span class="dots"></span>
      <span class="amount">${toPeso(amount)}</span>
    </div>
  `;
}

function summaryRowHtml(label: string, amount: number, emphasized = false) {
  return `
    <div class="summary-row${emphasized ? ' emphasized' : ''}">
      <span>${escapeHtml(label)}</span>
      <span>${toPeso(amount)}</span>
    </div>
  `;
}

function toPrintHtml(input: FinalBillPrintInput) {
  const bill = input.bill;
  const items = Array.isArray(input.items) ? input.items : [];

  const patient = resolvePatientRow(bill);
  const patientName = resolvePatientName(patient, bill.patient_id);
  const patientAge = normalizeText(patient?.age);
  const patientGender = normalizeText(patient?.gender);
  const ageGender = [patientAge, patientGender].filter(Boolean).join(' / ');

  const totals = buildSectionTotals(bill, items);
  const group1Subtotal = totals.medications + totals.laboratory;
  const isSenior = normalizeText(bill.discount_type).toLowerCase() === 'senior citizen';
  const isPwd = normalizeText(bill.discount_type).toLowerCase() === 'pwd';
  const showLess = isSenior || isPwd;
  const lessAmount = showLess ? Math.max(0, toNumber(bill.less_amount)) : 0;
  const group1TotalAmount = Math.max(0, group1Subtotal - lessAmount);
  const group2TotalAmount = totals.miscellaneous + totals.roomCharge + totals.professionalFee;
  const netAmount = Math.max(0, toNumber(bill.net_amount));

  const showGroup1 = totals.medications > 0 || totals.laboratory > 0;
  const showGroup2 = totals.miscellaneous > 0 || totals.roomCharge > 0 || totals.professionalFee > 0;

  const group1Rows = [
    totals.medications > 0 ? breakdownRowsHtml('Medications', totals.medications) : '',
    totals.laboratory > 0 ? breakdownRowsHtml('Laboratory', totals.laboratory) : '',
  ].join('');

  const group2Rows = [
    totals.miscellaneous > 0 ? breakdownRowsHtml('Miscellaneous', totals.miscellaneous) : '',
    totals.roomCharge > 0 ? breakdownRowsHtml('Room Charge', totals.roomCharge) : '',
    totals.professionalFee > 0 ? breakdownRowsHtml('Professional Fee', totals.professionalFee) : '',
  ].join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Final Billing - ${escapeHtml(normalizeText(bill.bill_code) || `BILL-${toNumber(bill.bill_id)}`)}</title>
    <style>
      @page { size: A4 portrait; margin: 0; }
      html, body {
        margin: 0;
        padding: 0;
        width: 210mm;
        height: 297mm;
      }
      body {
        font-family: Arial, sans-serif;
        font-size: 14px;
        color: #111827;
        background: #ffffff;
      }
      .sheet {
        width: 210mm;
        height: 297mm;
        max-height: 297mm;
        box-sizing: border-box;
        padding: 8mm 8mm 6mm;
        position: relative;
        display: block;
        overflow: hidden;
      }
      .header {
        text-align: center;
        margin-bottom: 6px;
      }
      .header-row {
        display: grid;
        grid-template-columns: 74px 1fr 74px;
        align-items: center;
        column-gap: 10px;
      }
      .logo {
        width: 54px;
        height: 54px;
        justify-self: center;
      }
      .clinic-name { font-size: 20px; font-weight: 700; line-height: 1.1; }
      .clinic-subname { font-size: 14px; font-weight: 600; line-height: 1.1; margin-top: 1px; }
      .contact {
        margin-top: 3px;
        line-height: 1.2;
      }
      .content {
        min-height: 0;
        padding-bottom: 34mm;
        overflow: hidden;
      }
      .patient-box {
        border: 1px solid #374151;
        border-radius: 12px;
        padding: 6px 8px;
        margin-bottom: 8px;
        page-break-inside: auto;
      }
      .patient-grid {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .patient-grid td {
        padding: 3px 4px;
        vertical-align: top;
        width: 50%;
      }
      .field-label {
        font-weight: 700;
      }
      .field-value {
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
        display: inline;
      }
      .breakdown {
        margin-top: 2px;
        margin-bottom: 0;
        page-break-inside: auto;
      }
      .amount-header {
        display: grid;
        grid-template-columns: 1fr 138px;
        margin-bottom: 1px;
        font-weight: 700;
      }
      .amount-header span:last-child {
        text-align: right;
      }
      .amount-row {
        display: grid;
        grid-template-columns: auto 1fr 138px;
        align-items: end;
        column-gap: 5px;
        margin: 1.5px 0;
      }
      .left-label { white-space: nowrap; }
      .dots {
        border-bottom: 1px dotted #111827;
        transform: translateY(-3px);
      }
      .amount {
        text-align: right;
        white-space: nowrap;
      }
      .summary-block {
        margin-left: auto;
        width: 290px;
        margin-top: 2px;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        margin: 1.5px 0;
      }
      .summary-row.emphasized {
        font-weight: 700;
      }
      .group-sep {
        height: 5px;
      }
      .footer {
        position: absolute;
        left: 8mm;
        right: 8mm;
        bottom: 6mm;
        padding-top: 2px;
      }
      .footer-row {
        display: grid;
        grid-template-columns: 1fr 250px;
        gap: 14px;
        align-items: start;
      }
      .doctor {
        line-height: 1.25;
      }
      .final-bill-box {
        justify-self: end;
        width: 250px;
      }
      .final-bill-title {
        font-weight: 700;
        margin-bottom: 3px;
      }
      .final-bill-row {
        display: flex;
        justify-content: space-between;
        font-weight: 700;
      }
      @media print {
        html, body {
          width: 210mm !important;
          height: 297mm !important;
          overflow: hidden !important;
        }
        body {
          font-size: 14px !important;
          zoom: 1 !important;
          transform: none !important;
        }
        .sheet {
          font-size: 14px !important;
          width: 210mm !important;
          height: 297mm !important;
          max-height: 297mm !important;
          transform: none !important;
        }
        .header { margin-bottom: 4px; }
        .clinic-name { font-size: 22px !important; }
        .clinic-subname { font-size: 15px !important; }
        .logo { width: 54px; height: 54px; }
        .contact { line-height: 1.2; margin-top: 2px; font-size: 13px !important; }
        .patient-box { padding: 5px 8px; margin-bottom: 4px; }
        .patient-grid td { padding: 2px 4px; }
        .field-label,
        .field-value,
        .amount-header,
        .amount-row,
        .summary-row,
        .doctor,
        .final-bill-title,
        .final-bill-row {
          font-size: 14px !important;
        }
        .amount-row,
        .summary-row { margin: 1px 0; }
        .summary-block { width: 310px; margin-top: 1px; }
        .group-sep { height: 2px; }
        .footer { padding-top: 1px; }
        .footer-row { grid-template-columns: 1fr 265px; gap: 8px; }
        .final-bill-box { width: 265px; }
        .doctor { line-height: 1.15; }
        .patient-box,
        .breakdown,
        .footer {
          page-break-inside: auto !important;
          break-inside: auto !important;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <section class="header">
        <div class="header-row">
          <img src="${CLINIC_LOGO_DATA_URL}" alt="Clinic logo" class="logo" />
          <div>
            <div class="clinic-name">Malibiran Medical Clinic</div>
            <div class="clinic-subname">Family Medicine</div>
          </div>
          <img src="${CLINIC_LOGO_DATA_URL}" alt="Clinic logo" class="logo" />
        </div>
        <div class="contact">
          <div>130 Old Samson Road, Brgy. Apolonio Samson Quezon City</div>
          <div>Cell# 0945-239-5382&nbsp;&nbsp;|&nbsp;&nbsp;malibiranmedicalclinic@gmail.com</div>
        </div>
      </section>

      <section class="content">
        <section class="patient-box">
          <table class="patient-grid">
            <tr>
              <td><span class="field-label">Patient Name:</span> <span class="field-value">${escapeHtml(patientName)}</span></td>
              <td><span class="field-label">Admission Date &amp; Time:</span> <span class="field-value">${escapeHtml(formatDateTimeNoTimezoneShift(bill.admission_datetime))}</span></td>
            </tr>
            <tr>
              <td><span class="field-label">Doctor in-Charge:</span> <span class="field-value">${escapeHtml(normalizeText(bill.doctor_in_charge))}</span></td>
              <td><span class="field-label">Discharge Date &amp; Time:</span> <span class="field-value">${escapeHtml(formatDateTimeNoTimezoneShift(bill.discharge_datetime))}</span></td>
            </tr>
            <tr>
              <td><span class="field-label">Age / Gender:</span> <span class="field-value">${escapeHtml(ageGender)}</span></td>
              <td><span class="field-label">Referred By:</span> <span class="field-value">${escapeHtml(normalizeText(bill.referred_by))}</span></td>
            </tr>
            <tr>
              <td><span class="field-label">Final Diagnosis:</span> <span class="field-value">${escapeHtml(normalizeText(bill.final_diagnosis))}</span></td>
              <td><span class="field-label">Discharge Status:</span> <span class="field-value">${escapeHtml(normalizeText(bill.discharge_status))}</span></td>
            </tr>
          </table>
        </section>

        <section class="breakdown">
          <div class="amount-header"><span></span><span>Amount</span></div>
          ${showGroup1 ? `
            ${group1Rows}
            <div class="summary-block">
              ${summaryRowHtml('Subtotal:', group1Subtotal, true)}
              ${showLess ? summaryRowHtml(`LESS (${isSenior ? 'Senior Citizen' : 'PWD'}):`, lessAmount, true) : ''}
              ${summaryRowHtml('Total Amount:', group1TotalAmount, true)}
            </div>
          ` : ''}

          ${(showGroup1 && showGroup2) ? '<div class="group-sep"></div>' : ''}

          ${showGroup2 ? `
            ${group2Rows}
            <div class="summary-block">
              ${summaryRowHtml('Total Amount:', group2TotalAmount, true)}
            </div>
          ` : ''}
        </section>
      </section>

      <footer class="footer">
        <div class="footer-row">
          <div class="doctor">
            <strong>Henry G. Malibiran, M.D.</strong><br />
            License No: 071919<br />
            PTR No: 4256492D
          </div>
          <div class="final-bill-box">
            <div class="final-bill-title">Final Bill:</div>
            <div class="final-bill-row">
              <span>Total Amount:</span>
              <span>${toPeso(netAmount)}</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  </body>
</html>`;
}

async function waitForPrintCompletion(printWindow: Window) {
  const waitForImagesReady = async () => {
    const doc = printWindow.document;
    const images = Array.from(doc.images || []);
    if (!images.length) return;

    await Promise.all(
      images.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete && img.naturalWidth > 0) {
              resolve();
              return;
            }

            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          }),
      ),
    );

    await Promise.all(
      images.map(async (img) => {
        if (typeof img.decode === 'function') {
          try {
            await img.decode();
          } catch {
            // Ignore decode failures; load/error listeners above are the fallback.
          }
        }
      }),
    );
  };

  await new Promise<void>((resolve) => {
    let done = false;
    const finalize = () => {
      if (done) return;
      done = true;
      resolve();
    };

    printWindow.addEventListener('afterprint', finalize, { once: true });

    const triggerPrint = async () => {
      await waitForImagesReady();
      printWindow.focus();
      printWindow.print();
    };

    if (printWindow.document.readyState === 'complete') {
      void triggerPrint();
    } else {
      printWindow.addEventListener('load', () => {
        void triggerPrint();
      }, { once: true });
    }

    window.setTimeout(finalize, 120000);
  });
}

async function printFinalBill(input: FinalBillPrintInput) {
  const printWindow = window.open('', '_blank', 'width=900,height=1100');
  if (!printWindow) {
    throw new Error('Please allow pop-ups to print the bill.');
  }

  printWindow.document.open();
  printWindow.document.write(toPrintHtml(input));
  printWindow.document.close();

  await waitForPrintCompletion(printWindow);
  printWindow.close();
}

export { printFinalBill };
export type { FinalBillPrintInput };
