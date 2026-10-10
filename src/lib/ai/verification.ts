/**
 * Pure Deterministic Invoice Verification Engine (Phase 6.6)
 *
 * Implements rigorous statutory and mathematical consistency rules for Indian GST invoices.
 * Every check returns `{ code, severity: 'error' | 'warning', field, message }`.
 */

export interface VerificationIssue {
  code: string;
  severity: 'error' | 'warning';
  field: string;
  message: string;
}

export interface VerificationInvoiceData {
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
  supplier?: {
    name?: string;
    gstin?: string;
    state_code?: string;
  };
  buyer?: {
    name?: string;
    gstin?: string;
    state_code?: string;
  };
  place_of_supply?: string;
  line_items?: Array<{
    description?: string;
    quantity?: number;
    rate?: number; // integer paise
    taxable_amount?: number; // integer paise
    tax_rate?: number; // e.g. 0.18 for 18%
    cgst?: number; // integer paise
    sgst?: number; // integer paise
    igst?: number; // integer paise
    total?: number; // integer paise
  }>;
  totals?: {
    subtotal?: number; // integer paise
    cgst?: number; // integer paise
    sgst?: number; // integer paise
    igst?: number; // integer paise
    cess?: number; // integer paise
    round_off?: number; // integer paise
    grand_total?: number; // integer paise
  };
}

// Valid Indian State Codes under GST (01-38, 97 for Other Territory, 99 for Centre)
const VALID_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
  '21', '22', '23', '24', '25', '26', '27', '28', '29', '30',
  '31', '32', '33', '34', '35', '36', '37', '38', '97', '99',
]);

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Validates GSTIN Regex and State Code (Severity: Error)
 */
export function checkGstinFormat(gstin: string | undefined, fieldName = 'supplier.gstin'): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  if (!gstin) return issues;

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  if (!gstinRegex.test(gstin)) {
    issues.push({
      code: 'GSTIN_FORMAT_INVALID',
      severity: 'error',
      field: fieldName,
      message: `${fieldName} '${gstin}' does not conform to 15-character GSTIN format.`,
    });
    return issues;
  }

  const stateCode = gstin.substring(0, 2);
  if (!VALID_STATE_CODES.has(stateCode)) {
    issues.push({
      code: 'GSTIN_STATE_INVALID',
      severity: 'error',
      field: fieldName,
      message: `${fieldName} state prefix '${stateCode}' is not a recognized Indian GST state code.`,
    });
  }

  return issues;
}

/**
 * Validates GSTIN Modulo 36 Checksum (Severity: Warning - per spec for sample/fictional data)
 */
export function checkGstinChecksum(gstin: string | undefined, fieldName = 'supplier.gstin'): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  if (!gstin || gstin.length !== 15) return issues;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const char = gstin[i];
    const v = GSTIN_CHARSET.indexOf(char);
    if (v === -1) return issues; // Invalid character

    const factor = i % 2 === 0 ? 1 : 2;
    const p = v * factor;
    sum += Math.floor(p / 36) + (p % 36);
  }

  const checkIndex = (36 - (sum % 36)) % 36;
  const expectedCheckChar = GSTIN_CHARSET[checkIndex];
  const actualCheckChar = gstin[14];

  if (expectedCheckChar !== actualCheckChar) {
    issues.push({
      code: 'GSTIN_CHECKSUM_MISMATCH',
      severity: 'warning',
      field: fieldName,
      message: `${fieldName} checksum character '${actualCheckChar}' does not match computed checksum '${expectedCheckChar}'.`,
    });
  }

  return issues;
}

/**
 * Validates Line-Item Arithmetic (within 100 paise tolerance)
 */
export function checkLineArithmetic(lines: VerificationInvoiceData['line_items'] = []): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  lines.forEach((line, idx) => {
    const prefix = `line_items[${idx}]`;

    // 1. Quantity * Rate = Taxable Amount
    if (line.quantity !== undefined && line.rate !== undefined && line.taxable_amount !== undefined) {
      const expectedTaxable = Math.round(line.quantity * line.rate);
      const diff = Math.abs(expectedTaxable - line.taxable_amount);
      if (diff > 100) {
        issues.push({
          code: 'LINE_MATH_TAXABLE_MISMATCH',
          severity: 'error',
          field: `${prefix}.taxable_amount`,
          message: `${prefix}: quantity (${line.quantity}) * rate (${line.rate} paise) = ${expectedTaxable} paise, but taxable_amount is ${line.taxable_amount} paise (difference: ${diff} paise).`,
        });
      }
    }

    // 2. Line Tax = Taxable Amount * Tax Rate
    if (line.taxable_amount !== undefined && line.tax_rate !== undefined) {
      const lineTax = (line.cgst || 0) + (line.sgst || 0) + (line.igst || 0);
      const expectedTax = Math.round(line.taxable_amount * line.tax_rate);
      const diffTax = Math.abs(expectedTax - lineTax);
      if (diffTax > 100 && lineTax > 0) {
        issues.push({
          code: 'LINE_MATH_TAX_MISMATCH',
          severity: 'error',
          field: `${prefix}.tax`,
          message: `${prefix}: taxable_amount (${line.taxable_amount} paise) * tax_rate (${line.tax_rate}) = ${expectedTax} paise, but total line tax is ${lineTax} paise.`,
        });
      }
    }
  });

  return issues;
}

/**
 * Validates Tax Type Consistency (Intra-state CGST+SGST vs Inter-state IGST)
 */
export function checkTaxType(data: VerificationInvoiceData): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  const supplierState = data.supplier?.state_code || (data.supplier?.gstin ? data.supplier.gstin.substring(0, 2) : undefined);
  const pos = data.place_of_supply || (data.buyer?.state_code || (data.buyer?.gstin ? data.buyer.gstin.substring(0, 2) : undefined));

  if (!supplierState || !pos) {
    return issues; // Cannot evaluate without both state codes
  }

  const totals = data.totals || {};
  const cgst = totals.cgst || 0;
  const sgst = totals.sgst || 0;
  const igst = totals.igst || 0;

  if (supplierState === pos) {
    // Intra-state: CGST and SGST expected, IGST must be 0
    if (igst > 100) {
      issues.push({
        code: 'TAX_TYPE_INTRA_STATE_IGST_FORBIDDEN',
        severity: 'error',
        field: 'totals.igst',
        message: `Intra-state supply (Supplier state ${supplierState} equals Place of Supply ${pos}) cannot charge IGST (${igst} paise).`,
      });
    }

    // CGST should equal SGST within 100 paise
    if (Math.abs(cgst - sgst) > 100) {
      issues.push({
        code: 'TAX_TYPE_CGST_SGST_MISMATCH',
        severity: 'error',
        field: 'totals.cgst_sgst',
        message: `Intra-state supply requires equal CGST and SGST, but CGST is ${cgst} paise and SGST is ${sgst} paise.`,
      });
    }
  } else {
    // Inter-state: IGST expected, CGST and SGST must be 0
    if (cgst > 100 || sgst > 100) {
      issues.push({
        code: 'TAX_TYPE_INTER_STATE_CGST_SGST_FORBIDDEN',
        severity: 'error',
        field: 'totals.cgst_sgst',
        message: `Inter-state supply (Supplier state ${supplierState} differs from Place of Supply ${pos}) must charge IGST, not CGST (${cgst} paise) or SGST (${sgst} paise).`,
      });
    }
  }

  return issues;
}

/**
 * Validates Subtotal, Taxes, and Grand Total Reconciliation
 */
export function checkTotals(data: VerificationInvoiceData): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  const totals = data.totals;
  if (!totals) return issues;

  const lines = data.line_items || [];

  // 1. Sum of line taxable amounts equals subtotal
  if (lines.length > 0 && totals.subtotal !== undefined) {
    const computedSubtotal = lines.reduce((acc, l) => acc + (l.taxable_amount || 0), 0);
    const diff = Math.abs(computedSubtotal - totals.subtotal);
    if (diff > 100) {
      issues.push({
        code: 'TOTALS_SUBTOTAL_MISMATCH',
        severity: 'error',
        field: 'totals.subtotal',
        message: `Sum of line item taxable amounts (${computedSubtotal} paise) does not equal subtotal (${totals.subtotal} paise).`,
      });
    }
  }

  // 2. Subtotal + Taxes + Round-off = Grand Total
  if (totals.grand_total !== undefined && totals.subtotal !== undefined) {
    const taxes = (totals.cgst || 0) + (totals.sgst || 0) + (totals.igst || 0) + (totals.cess || 0);
    const roundOff = totals.round_off || 0;
    const computedGrandTotal = totals.subtotal + taxes + roundOff;
    const diff = Math.abs(computedGrandTotal - totals.grand_total);
    if (diff > 100) {
      issues.push({
        code: 'TOTALS_GRAND_TOTAL_MISMATCH',
        severity: 'error',
        field: 'totals.grand_total',
        message: `Computed grand total (subtotal ${totals.subtotal} + taxes ${taxes} + round_off ${roundOff} = ${computedGrandTotal} paise) does not match reported grand_total (${totals.grand_total} paise).`,
      });
    }
  }

  return issues;
}

/**
 * Validates Dates (Not > 1 day in future, not > 5 years old, due_date >= invoice_date)
 */
export function checkDates(data: VerificationInvoiceData): VerificationIssue[] {
  const issues: VerificationIssue[] = [];
  if (!data.invoice_date) return issues;

  const invoiceDate = new Date(data.invoice_date);
  if (isNaN(invoiceDate.getTime())) {
    issues.push({
      code: 'DATE_INVOICE_INVALID',
      severity: 'error',
      field: 'invoice_date',
      message: `Invoice date '${data.invoice_date}' is not a valid ISO date.`,
    });
    return issues;
  }

  const now = new Date();
  const oneDayAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const fiveYearsAgo = new Date(now.getTime() - 5 * 365.25 * 24 * 60 * 60 * 1000);

  if (invoiceDate > oneDayAhead) {
    issues.push({
      code: 'DATE_INVOICE_FUTURE',
      severity: 'error',
      field: 'invoice_date',
      message: `Invoice date '${data.invoice_date}' is in the future.`,
    });
  }

  if (invoiceDate < fiveYearsAgo) {
    issues.push({
      code: 'DATE_INVOICE_EXPIRED',
      severity: 'error',
      field: 'invoice_date',
      message: `Invoice date '${data.invoice_date}' is more than 5 years old.`,
    });
  }

  if (data.due_date) {
    const dueDate = new Date(data.due_date);
    if (!isNaN(dueDate.getTime()) && dueDate < invoiceDate) {
      issues.push({
        code: 'DATE_DUE_BEFORE_INVOICE',
        severity: 'error',
        field: 'due_date',
        message: `Due date '${data.due_date}' cannot be before invoice date '${data.invoice_date}'.`,
      });
    }
  }

  return issues;
}

/**
 * Validates Presence of Statutory Required Fields
 */
export function checkRequiredFields(data: VerificationInvoiceData): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  if (!data.invoice_number || data.invoice_number.trim() === '') {
    issues.push({
      code: 'REQUIRED_FIELD_MISSING',
      severity: 'error',
      field: 'invoice_number',
      message: 'Invoice number is missing or empty.',
    });
  }

  if (!data.invoice_date || data.invoice_date.trim() === '') {
    issues.push({
      code: 'REQUIRED_FIELD_MISSING',
      severity: 'error',
      field: 'invoice_date',
      message: 'Invoice date is missing or empty.',
    });
  }

  if (!data.supplier?.name || data.supplier.name.trim() === '') {
    issues.push({
      code: 'REQUIRED_FIELD_MISSING',
      severity: 'error',
      field: 'supplier.name',
      message: 'Supplier name is missing or empty.',
    });
  }

  if (data.totals?.grand_total === undefined || data.totals.grand_total === null) {
    issues.push({
      code: 'REQUIRED_FIELD_MISSING',
      severity: 'error',
      field: 'totals.grand_total',
      message: 'Grand total is missing or empty.',
    });
  }

  return issues;
}

/**
 * Executes complete deterministic verification suite
 */
export function runDeterministicChecks(data: VerificationInvoiceData): VerificationIssue[] {
  return [
    ...checkRequiredFields(data),
    ...checkGstinFormat(data.supplier?.gstin, 'supplier.gstin'),
    ...checkGstinChecksum(data.supplier?.gstin, 'supplier.gstin'),
    ...checkGstinFormat(data.buyer?.gstin, 'buyer.gstin'),
    ...checkGstinChecksum(data.buyer?.gstin, 'buyer.gstin'),
    ...checkLineArithmetic(data.line_items),
    ...checkTaxType(data),
    ...checkTotals(data),
    ...checkDates(data),
  ];
}
