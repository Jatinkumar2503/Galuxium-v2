import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

async function generateSampleInvoice() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // Background subtle border
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderColor: rgb(0.85, 0.82, 0.75),
    borderWidth: 1.5,
  });

  // Top header banner
  page.drawRectangle({
    x: 30,
    y: height - 90,
    width: width - 60,
    height: 60,
    color: rgb(0.96, 0.94, 0.90),
  });

  page.drawText('TAX INVOICE', {
    x: 45,
    y: height - 65,
    size: 20,
    font: fontBold,
    color: rgb(0.17, 0.16, 0.14),
  });

  page.drawText('ORIGINAL FOR RECIPIENT', {
    x: width - 210,
    y: height - 60,
    size: 10,
    font: fontBold,
    color: rgb(0.54, 0.42, 0.22),
  });

  // Seller Details (Left)
  let y = height - 120;
  page.drawText('SUPPLIER (SELLER):', { x: 45, y, size: 10, font: fontBold, color: rgb(0.43, 0.40, 0.35) });
  y -= 16;
  page.drawText('Apex Tech Solutions Private Limited', { x: 45, y, size: 12, font: fontBold, color: rgb(0.17, 0.16, 0.14) });
  y -= 14;
  page.drawText('Plot 42, Bandra-Kurla Complex, Bandra East', { x: 45, y, size: 9, font: fontRegular, color: rgb(0.25, 0.25, 0.25) });
  y -= 13;
  page.drawText('Mumbai, Maharashtra - 400051', { x: 45, y, size: 9, font: fontRegular, color: rgb(0.25, 0.25, 0.25) });
  y -= 13;
  page.drawText('GSTIN: 27AABCU9603R1ZM | State Code: 27', { x: 45, y, size: 9, font: fontBold, color: rgb(0.17, 0.16, 0.14) });
  y -= 13;
  page.drawText('Email: accounts@apextech.in | Phone: +91 22 2650 9900', { x: 45, y, size: 9, font: fontRegular, color: rgb(0.25, 0.25, 0.25) });

  // Invoice Metadata (Right)
  let yMeta = height - 120;
  page.drawText('INVOICE DETAILS:', { x: 350, y: yMeta, size: 10, font: fontBold, color: rgb(0.43, 0.40, 0.35) });
  yMeta -= 16;
  page.drawText('Invoice No: INV-2026-0042', { x: 350, y: yMeta, size: 10, font: fontBold, color: rgb(0.17, 0.16, 0.14) });
  yMeta -= 14;
  page.drawText('Invoice Date: 10-Oct-2026', { x: 350, y: yMeta, size: 9, font: fontRegular, color: rgb(0.25, 0.25, 0.25) });
  yMeta -= 13;
  page.drawText('Payment Terms: Net 30 Days', { x: 350, y: yMeta, size: 9, font: fontRegular, color: rgb(0.25, 0.25, 0.25) });
  yMeta -= 13;
  page.drawText('Place of Supply: Maharashtra (27)', { x: 350, y: yMeta, size: 9, font: fontRegular, color: rgb(0.25, 0.25, 0.25) });
  yMeta -= 13;
  page.drawText('Reverse Charge: No', { x: 350, y: yMeta, size: 9, font: fontRegular, color: rgb(0.25, 0.25, 0.25) });

  // Divider
  y -= 20;
  page.drawLine({
    start: { x: 45, y },
    end: { x: width - 45, y },
    thickness: 1,
    color: rgb(0.85, 0.82, 0.75),
  });

  // Buyer Details
  y -= 18;
  page.drawText('BILLED TO (BUYER):', { x: 45, y, size: 10, font: fontBold, color: rgb(0.43, 0.40, 0.35) });
  y -= 15;
  page.drawText('Galuxium Enterprises LLP', { x: 45, y, size: 11, font: fontBold, color: rgb(0.17, 0.16, 0.14) });
  y -= 13;
  page.drawText('Tech Park V, Hinjawadi Phase 2, Pune, Maharashtra - 411057', { x: 45, y, size: 9, font: fontRegular, color: rgb(0.25, 0.25, 0.25) });
  y -= 13;
  page.drawText('GSTIN: 27AABCU9604R1ZN | State: Maharashtra (27)', { x: 45, y, size: 9, font: fontBold, color: rgb(0.17, 0.16, 0.14) });

  // Line Items Table Header
  y -= 25;
  page.drawRectangle({
    x: 45,
    y: y - 5,
    width: width - 90,
    height: 22,
    color: rgb(0.94, 0.92, 0.86),
  });

  page.drawText('#', { x: 52, y, size: 9, font: fontBold });
  page.drawText('Description of Services', { x: 75, y, size: 9, font: fontBold });
  page.drawText('HSN/SAC', { x: 260, y, size: 9, font: fontBold });
  page.drawText('Qty', { x: 325, y, size: 9, font: fontBold });
  page.drawText('Rate (INR)', { x: 370, y, size: 9, font: fontBold });
  page.drawText('Taxable Value (INR)', { x: 460, y, size: 9, font: fontBold });

  // Table Row 1
  y -= 22;
  page.drawText('1', { x: 52, y, size: 9, font: fontRegular });
  page.drawText('Cloud Architecture & AI Pipeline Consulting', { x: 75, y, size: 9, font: fontRegular });
  page.drawText('998313', { x: 260, y, size: 9, font: fontRegular });
  page.drawText('1', { x: 330, y, size: 9, font: fontRegular });
  page.drawText('85,000.00', { x: 375, y, size: 9, font: fontRegular });
  page.drawText('85,000.00', { x: 485, y, size: 9, font: fontRegular });

  // Table Row 2
  y -= 20;
  page.drawText('2', { x: 52, y, size: 9, font: fontRegular });
  page.drawText('Financial Systems Security & Infrastructure Audit', { x: 75, y, size: 9, font: fontRegular });
  page.drawText('998314', { x: 260, y, size: 9, font: fontRegular });
  page.drawText('1', { x: 330, y, size: 9, font: fontRegular });
  page.drawText('45,000.00', { x: 375, y, size: 9, font: fontRegular });
  page.drawText('45,000.00', { x: 485, y, size: 9, font: fontRegular });

  // Line below items
  y -= 15;
  page.drawLine({
    start: { x: 45, y },
    end: { x: width - 45, y },
    thickness: 1,
    color: rgb(0.85, 0.82, 0.75),
  });

  // Summary Table (Right aligned)
  y -= 20;
  page.drawText('Taxable Amount:', { x: 340, y, size: 9, font: fontRegular });
  page.drawText('INR 1,30,000.00', { x: 465, y, size: 9, font: fontBold });

  y -= 16;
  page.drawText('CGST @ 9%:', { x: 340, y, size: 9, font: fontRegular });
  page.drawText('INR 11,700.00', { x: 472, y, size: 9, font: fontRegular });

  y -= 16;
  page.drawText('SGST @ 9%:', { x: 340, y, size: 9, font: fontRegular });
  page.drawText('INR 11,700.00', { x: 472, y, size: 9, font: fontRegular });

  y -= 18;
  page.drawRectangle({
    x: 330,
    y: y - 5,
    width: width - 375,
    height: 22,
    color: rgb(0.96, 0.94, 0.90),
  });
  page.drawText('Total Invoice Amount:', { x: 340, y, size: 10, font: fontBold, color: rgb(0.17, 0.16, 0.14) });
  page.drawText('INR 1,53,400.00', { x: 462, y, size: 10, font: fontBold, color: rgb(0.54, 0.42, 0.22) });

  // Amount in words
  y -= 30;
  page.drawText('Amount in Words:', { x: 45, y, size: 9, font: fontBold, color: rgb(0.43, 0.40, 0.35) });
  y -= 14;
  page.drawText('INR One Lakh Fifty-Three Thousand Four Hundred Only', { x: 45, y, size: 9, font: fontBold, color: rgb(0.17, 0.16, 0.14) });

  // Banking Details
  y -= 30;
  page.drawText('BANKING DETAILS:', { x: 45, y, size: 9, font: fontBold, color: rgb(0.43, 0.40, 0.35) });
  y -= 14;
  page.drawText('Bank Name: HDFC Bank Ltd', { x: 45, y, size: 8.5, font: fontRegular });
  y -= 12;
  page.drawText('Account Name: Apex Tech Solutions Pvt Ltd', { x: 45, y, size: 8.5, font: fontRegular });
  y -= 12;
  page.drawText('Account Number: 50200088991122', { x: 45, y, size: 8.5, font: fontRegular });
  y -= 12;
  page.drawText('IFSC Code: HDFC0000128 | Branch: BKC, Mumbai', { x: 45, y, size: 8.5, font: fontRegular });

  // Signatory
  page.drawText('For Apex Tech Solutions Pvt Ltd', { x: width - 210, y: y + 24, size: 9, font: fontBold });
  page.drawText('Authorized Signatory', { x: width - 180, y: 55, size: 8.5, font: fontRegular, color: rgb(0.43, 0.40, 0.35) });

  // Footer notice
  page.drawText('This is a computer-generated invoice.', {
    x: 45,
    y: 45,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  });

  const pdfBytes = await doc.save();

  const outPath1 = 'C:\\Users\\Asus\\Documents\\sample_invoice.pdf';
  const outPath2 = join(process.cwd(), 'docs', 'sample_invoice.pdf');

  writeFileSync(outPath1, pdfBytes);
  writeFileSync(outPath2, pdfBytes);

  console.log(`Successfully generated valid PDF invoice:`);
  console.log(`1. ${outPath1} (${pdfBytes.length} bytes)`);
  console.log(`2. ${outPath2} (${pdfBytes.length} bytes)`);
}

generateSampleInvoice().catch((err) => {
  console.error(err);
  process.exit(1);
});
