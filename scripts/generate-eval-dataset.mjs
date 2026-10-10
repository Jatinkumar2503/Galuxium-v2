import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const EVAL_DIR = join(process.cwd(), 'eval');
mkdirSync(EVAL_DIR, { recursive: true });

async function createSimplePdf(title, lines, totals, extra = {}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const { width, height } = page.getSize();
  page.drawText(title, { x: 50, y: height - 50, size: 16, font: fontBold });

  let y = height - 80;
  if (extra.supplier) {
    page.drawText(`Supplier: ${extra.supplier.name}`, { x: 50, y, size: 10, font: fontBold });
    y -= 14;
    page.drawText(`GSTIN: ${extra.supplier.gstin}`, { x: 50, y, size: 9, font: fontRegular });
    y -= 14;
  }
  if (extra.buyer) {
    page.drawText(`Buyer: ${extra.buyer.name}`, { x: 50, y, size: 10, font: fontBold });
    y -= 14;
    page.drawText(`GSTIN: ${extra.buyer.gstin || 'N/A'}`, { x: 50, y, size: 9, font: fontRegular });
    y -= 14;
  }
  if (extra.invoiceNumber) {
    page.drawText(`Invoice No: ${extra.invoiceNumber} | Date: ${extra.invoiceDate || '2026-10-10'}`, { x: 50, y, size: 10, font: fontBold });
    y -= 20;
  }

  // Draw lines
  lines.forEach((l, i) => {
    page.drawText(`${i + 1}. ${l.description} | Qty: ${l.qty} | Rate: ${(l.rate / 100).toFixed(2)} | Taxable: ${(l.taxable / 100).toFixed(2)}`, {
      x: 50,
      y,
      size: 9,
      font: fontRegular,
    });
    y -= 14;
  });

  y -= 10;
  page.drawText(`Subtotal: ${(totals.subtotal / 100).toFixed(2)} INR`, { x: 50, y, size: 9, font: fontBold });
  y -= 14;
  page.drawText(`Taxes (CGST+SGST+IGST): ${(totals.taxes / 100).toFixed(2)} INR`, { x: 50, y, size: 9, font: fontRegular });
  y -= 14;
  page.drawText(`Grand Total: ${(totals.grandTotal / 100).toFixed(2)} INR`, { x: 50, y, size: 11, font: fontBold });

  if (extra.isTwoPage) {
    const page2 = doc.addPage([595.28, 841.89]);
    page2.drawText('Page 2: Terms and Statutory Notes', { x: 50, y: height - 50, size: 12, font: fontBold });
    page2.drawText('Authorized Signatory & Bank Details', { x: 50, y: height - 80, size: 10, font: fontRegular });
  }

  return await doc.save();
}

async function createSyntheticImage(text, options = {}) {
  // Create SVG image with text
  const svg = `
    <svg width="800" height="1000" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${options.bg || '#F7F4EE'}" />
      <rect x="40" y="40" width="720" height="920" fill="#FFFFFF" stroke="#D9D0BF" stroke-width="2" />
      <text x="60" y="80" font-family="sans-serif" font-size="22" font-weight="bold" fill="#2B2824">${text.title}</text>
      <text x="60" y="115" font-family="sans-serif" font-size="14" fill="#6E665A">Supplier: ${text.supplier.replace(/&/g, '&amp;')}</text>
      <text x="60" y="135" font-family="sans-serif" font-size="14" font-weight="bold" fill="#2B2824">GSTIN: ${text.gstin}</text>
      <text x="60" y="155" font-family="sans-serif" font-size="14" fill="#2B2824">Invoice No: ${text.invNo} | Date: ${text.date}</text>
      <line x1="60" y1="175" x2="700" y2="175" stroke="#D9D0BF" stroke-width="1" />
      <text x="60" y="210" font-family="sans-serif" font-size="14" fill="#2B2824">${text.lineItem.replace(/&/g, '&amp;')}</text>
      <text x="60" y="260" font-family="sans-serif" font-size="16" font-weight="bold" fill="#2B2824">Grand Total: ${text.total}</text>
      ${text.handwritten ? `<text x="60" y="320" font-family="cursive" font-size="18" fill="#B5523B">Approved by Accounts: Cash Paid</text>` : ''}
    </svg>
  `;

  let pipeline = sharp(Buffer.from(svg));
  if (options.blur) {
    pipeline = pipeline.blur(options.blur);
  }
  if (options.rotate) {
    pipeline = pipeline.rotate(options.rotate, { background: '#EFEBE3' });
  }

  return await pipeline.jpeg({ quality: options.quality || 90 }).toBuffer();
}

async function main() {
  console.log('Generating 20 evaluation benchmark documents in eval/ ...');

  // Ground truth database
  const evalSpecs = [
    // 1 to 8: Clean PDFs
    { id: '01', type: 'pdf', title: 'Tax Invoice INV-2026-101', invNo: 'INV-2026-101', date: '2026-10-01', gstin: '27AABCU9603R1ZM', total: 1180000, tax: 180000, desc: 'Clean PDF Template 1' },
    { id: '02', type: 'pdf', title: 'Tax Invoice INV-2026-102', invNo: 'INV-2026-102', date: '2026-10-02', gstin: '27AABCU9603R1ZM', total: 2360000, tax: 360000, desc: 'Clean PDF Alternate Columns' },
    { id: '03', type: 'pdf', title: 'Tax Invoice INV-2026-103', invNo: 'INV-2026-103', date: '2026-10-03', gstin: '27AABCU9603R1ZM', total: 5900000, tax: 900000, isTwoPage: true, desc: 'Clean PDF Two-Page' },
    { id: '04', type: 'pdf', title: 'Tax Invoice INV-2026-104', invNo: 'INV-2026-104', date: '2026-10-04', gstin: '27AABCU9603R1ZM', total: 1770000, tax: 270000, desc: 'Clean PDF Inter-state IGST' },
    { id: '05', type: 'pdf', title: 'Tax Invoice INV-2026-105', invNo: 'INV-2026-105', date: '2026-10-05', gstin: '27AABCU9603R1ZM', total: 3540000, tax: 540000, desc: 'Clean PDF Professional Services' },
    { id: '06', type: 'pdf', title: 'Tax Invoice INV-2026-106', invNo: 'INV-2026-106', date: '2026-10-06', gstin: '27AABCU9603R1ZM', total: 8260000, tax: 1260000, desc: 'Clean PDF Manufacturing HSN' },
    { id: '07', type: 'pdf', title: 'Tax Invoice INV-2026-107', invNo: 'INV-2026-107', date: '2026-10-07', gstin: '27AABCU9603R1ZM', total: 4720000, tax: 720000, desc: 'Clean PDF Retail Items' },
    { id: '08', type: 'pdf', title: 'Tax Invoice INV-2026-108', invNo: 'INV-2026-108', date: '2026-10-08', gstin: '27AABCU9603R1ZM', total: 9440000, tax: 1440000, isTwoPage: true, desc: 'Clean PDF Logistics Two-Page' },

    // 9 to 12: Phone Photos
    { id: '09', type: 'img', title: 'Invoice INV-2026-109', invNo: 'INV-2026-109', date: '2026-10-09', gstin: '27AABCU9603R1ZM', total: 1180000, tax: 180000, desc: 'Phone Photo Angled', rotate: 2 },
    { id: '10', type: 'img', title: 'Invoice INV-2026-110', invNo: 'INV-2026-110', date: '2026-10-10', gstin: '27AABCU9603R1ZM', total: 1416000, tax: 216000, desc: 'Phone Photo Dim Light', bg: '#DCD4C4' },
    { id: '11', type: 'img', title: 'Invoice INV-2026-111', invNo: 'INV-2026-111', date: '2026-10-09', gstin: '27AABCU9603R1ZM', total: 1652000, tax: 252000, desc: 'Phone Photo Slightly Blurry', blur: 0.5 },
    { id: '12', type: 'img', title: 'Invoice INV-2026-112', invNo: 'INV-2026-112', date: '2026-10-08', gstin: '27AABCU9603R1ZM', total: 2006000, tax: 306000, desc: 'Phone Photo Perspective Tilt', rotate: -1.5 },

    // 13 to 15: Handwriting on printed forms
    { id: '13', type: 'img', title: 'Voucher INV-2026-113', invNo: 'INV-2026-113', date: '2026-10-07', gstin: '27AABCU9603R1ZM', total: 590000, tax: 90000, desc: 'Handwriting Annotations', handwritten: true },
    { id: '14', type: 'img', title: 'Bill INV-2026-114', invNo: 'INV-2026-114', date: '2026-10-06', gstin: '27AABCU9603R1ZM', total: 885000, tax: 135000, desc: 'Manual Tax Entry', handwritten: true },
    { id: '15', type: 'img', title: 'Challan INV-2026-115', invNo: 'INV-2026-115', date: '2026-10-05', gstin: '27AABCU9603R1ZM', total: 1298000, tax: 198000, desc: 'Handwritten Cash Voucher', handwritten: true },

    // 16 to 18: Mixed Hindi & English (Rendered via Sharp SVG supporting Unicode Devanagari)
    { id: '16', type: 'img', title: 'कर बीजक / Tax Invoice INV-2026-116', invNo: 'INV-2026-116', date: '2026-10-04', gstin: '27AABCU9603R1ZM', total: 2360000, tax: 360000, desc: 'Bilingual Tax Invoice' },
    { id: '17', type: 'img', title: 'रसीद / Receipt INV-2026-117', invNo: 'INV-2026-117', date: '2026-10-03', gstin: '27AABCU9603R1ZM', total: 3540000, tax: 540000, desc: 'Bilingual Receipt' },
    { id: '18', type: 'img', title: 'आपूर्ति बीजक / Supply INV-2026-118', invNo: 'INV-2026-118', date: '2026-10-02', gstin: '27AABCU9603R1ZM', total: 4720000, tax: 720000, desc: 'Bilingual Supplier Meta' },

    // 19 to 20: Deliberately Wrong Invoices (to test verification flags)
    { id: '19', type: 'pdf', title: 'Tax Invoice INV-2026-119', invNo: 'INV-2026-119', date: '2026-10-01', gstin: '27AABCU9603R1ZM', total: 9999999, tax: 180000, desc: 'Deliberately Wrong: Tax Mismatch', shouldFailCheck: true },
    { id: '20', type: 'pdf', title: 'Tax Invoice INV-2026-120', invNo: 'INV-2026-120', date: '2026-10-01', gstin: '98AABCU9603R1ZM', total: 1180000, tax: 180000, desc: 'Deliberately Wrong: Invalid State GSTIN', shouldFailCheck: true },
  ];

  for (const s of evalSpecs) {
    const filename = `doc_${s.id}_${s.type === 'pdf' ? 'invoice.pdf' : 'invoice.jpg'}`;
    const jsonName = `doc_${s.id}_invoice.json`;

    const subtotal = s.total - s.tax;

    // Ground truth JSON
    const groundTruth = {
      id: s.id,
      category: s.desc,
      invoice_number: s.invNo,
      invoice_date: s.date,
      supplier_gstin: s.gstin,
      grand_total: s.total,
      total_tax: s.tax,
      subtotal: subtotal,
      should_fail_checks: s.shouldFailCheck || false,
    };

    writeFileSync(join(EVAL_DIR, jsonName), JSON.stringify(groundTruth, null, 2));

    if (s.type === 'pdf') {
      const pdfBytes = await createSimplePdf(
        s.title,
        [{ description: 'Consulting & Services', qty: 1, rate: subtotal, taxable: subtotal }],
        { subtotal, taxes: s.tax, grandTotal: s.total },
        {
          supplier: { name: 'Apex Tech Solutions Pvt Ltd', gstin: s.gstin },
          buyer: { name: 'Galuxium Enterprises LLP', gstin: '27AABCU9604R1ZN' },
          invoiceNumber: s.invNo,
          invoiceDate: s.date,
          isTwoPage: s.isTwoPage,
        }
      );
      writeFileSync(join(EVAL_DIR, filename), pdfBytes);
    } else {
      const imgBuffer = await createSyntheticImage(
        {
          title: s.title,
          supplier: 'Apex Tech Solutions Pvt Ltd',
          gstin: s.gstin,
          invNo: s.invNo,
          date: s.date,
          lineItem: 'Consulting & Services - Qty 1',
          total: `INR ${(s.total / 100).toFixed(2)}`,
          handwritten: s.handwritten,
        },
        { bg: s.bg, blur: s.blur, rotate: s.rotate }
      );
      writeFileSync(join(EVAL_DIR, filename), imgBuffer);
    }

    console.log(`  Created ${filename} & ${jsonName} (${s.desc})`);
  }

  console.log(`Successfully generated all 20 benchmark files in ${EVAL_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
