import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AnthropicInvoiceExtractor } from '../src/lib/ai/extractor.ts';
import { runDeterministicChecks } from '../src/lib/ai/verification.ts';
import { evaluateConfidence } from '../src/lib/ai/confidence.ts';
import { calculateExtractionCostMicros } from '../src/lib/ai/pricing.ts';

const EVAL_DIR = join(process.cwd(), 'eval');

async function runEvaluation() {
  console.log('================================================================================');
  console.log('GALUXIUM NEXUS V2 - EXTRACTION PIPELINE BENCHMARK (PHASE 6.9)');
  console.log('Model: ' + (process.env.EXTRACTION_MODEL || 'claude-sonnet-5-5'));
  console.log('Target Key-Field Accuracy: >= 90.0% (Pre-declared in ADR 010)');
  console.log('================================================================================\n');

  // Strict statutory requirement: Refuse to run without real Anthropic API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: eval-extraction.mjs requires a real ANTHROPIC_API_KEY to run the statutory benchmark.');
    console.error('Offline mock evaluation is strictly disallowed per Phase 6 governance.');
    console.error('Please configure ANTHROPIC_API_KEY in your environment before running this benchmark.');
    process.exit(1);
  }

  const jsonFiles = readdirSync(EVAL_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (jsonFiles.length === 0) {
    console.error('No evaluation files found in eval/');
    process.exit(1);
  }

  const extractor = new AnthropicInvoiceExtractor();

  let totalDocs = jsonFiles.length;
  let apiCallsCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalLatencyMs = 0;
  let totalCostMicros = 0;

  let correctInvoiceNumbers = 0;
  let correctInvoiceDates = 0;
  let correctGstins = 0;
  let correctGrandTotals = 0;
  let correctTotalTaxes = 0;
  let checksExpectedFlagged = 0;

  // Confidence calibration buckets: [0.90-1.00], [0.80-0.89], [0.70-0.79], [<0.70]
  const buckets = {
    '0.90 - 1.00': { total: 0, correct: 0 },
    '0.80 - 0.89': { total: 0, correct: 0 },
    '0.70 - 0.79': { total: 0, correct: 0 },
    '< 0.70': { total: 0, correct: 0 },
  };

  function getBucket(confidence) {
    if (confidence >= 0.9) return '0.90 - 1.00';
    if (confidence >= 0.8) return '0.80 - 0.89';
    if (confidence >= 0.7) return '0.70 - 0.79';
    return '< 0.70';
  }

  console.log('| ID | Description | Inv No | Date | GSTIN | Total | Tax | Conf | Pass/Fail |');
  console.log('|---|---|---|---|---|---|---|---|---|');

  for (const jsonFile of jsonFiles) {
    // Read ground truth purely for scoring (never fed to extractor)
    const rawGt = JSON.parse(readFileSync(join(EVAL_DIR, jsonFile), 'utf-8'));
    const docBaseName = jsonFile.replace('.json', '');

    // Look for matching document binary (.pdf or .jpg)
    let docPath = join(EVAL_DIR, `${docBaseName}.pdf`);
    let mimeType = 'application/pdf';
    try {
      readFileSync(docPath);
    } catch {
      docPath = join(EVAL_DIR, `${docBaseName}.jpg`);
      mimeType = 'image/jpeg';
    }

    const fileBuffer = readFileSync(docPath);

    // Run extraction through real AI model API
    const startTime = Date.now();
    const result = await extractor.extractInvoice({
      fileBuffer,
      mimeType,
      fileName: jsonFile,
      orgId: 'eval-org',
    });

    const latency = Date.now() - startTime;
    totalLatencyMs += latency;
    apiCallsCount++;
    totalInputTokens += result.inputTokens;
    totalOutputTokens += result.outputTokens;

    const cost = calculateExtractionCostMicros(result.model, result.inputTokens, result.outputTokens);
    totalCostMicros += cost;

    const issues = runDeterministicChecks(result.data);
    const confEval = evaluateConfidence(result.data.field_confidences, issues);

    // Pure scoring against ground truth
    const invNoMatch = result.data.invoice_number?.trim() === rawGt.invoice_number?.trim();
    const dateMatch = result.data.invoice_date === rawGt.invoice_date;
    const gstinMatch = result.data.supplier?.gstin?.toUpperCase() === rawGt.supplier_gstin?.toUpperCase();

    const extractedTotal = result.data.totals?.grand_total || 0;
    const totalMatch = Math.abs(extractedTotal - rawGt.grand_total) <= 100;

    const extractedTax =
      (result.data.totals?.cgst || 0) +
      (result.data.totals?.sgst || 0) +
      (result.data.totals?.igst || 0);
    const taxMatch = Math.abs(extractedTax - rawGt.total_tax) <= 100;

    if (invNoMatch) correctInvoiceNumbers++;
    if (dateMatch) correctInvoiceDates++;
    if (gstinMatch) correctGstins++;
    if (totalMatch) correctGrandTotals++;
    if (taxMatch) correctTotalTaxes++;

    const hasIssues = issues.length > 0;
    if (rawGt.should_fail_checks && hasIssues) {
      checksExpectedFlagged++;
    }

    const docPassed = invNoMatch && dateMatch && gstinMatch && totalMatch && taxMatch;

    const bucketKey = getBucket(confEval.overallConfidence);
    buckets[bucketKey].total++;
    if (docPassed) {
      buckets[bucketKey].correct++;
    }

    const mark = (val) => (val ? 'PASS' : 'FAIL');
    console.log(
      `| ${rawGt.id} | ${rawGt.category.substring(0, 24).padEnd(24)} | ${mark(invNoMatch)} | ${mark(dateMatch)} | ${mark(gstinMatch)} | ${mark(totalMatch)} | ${mark(taxMatch)} | ${confEval.overallConfidence.toFixed(2)} | ${docPassed ? 'PASS' : 'REVIEW'} |`
    );
  }

  if (apiCallsCount === 0) {
    console.error('ERROR: Zero API calls were executed. Benchmark invalid.');
    process.exit(1);
  }

  const totalTokens = totalInputTokens + totalOutputTokens;
  const invNoAcc = ((correctInvoiceNumbers / totalDocs) * 100).toFixed(1);
  const dateAcc = ((correctInvoiceDates / totalDocs) * 100).toFixed(1);
  const gstinAcc = ((correctGstins / totalDocs) * 100).toFixed(1);
  const totalAcc = ((correctGrandTotals / totalDocs) * 100).toFixed(1);
  const taxAcc = ((correctTotalTaxes / totalDocs) * 100).toFixed(1);

  const keyFieldAcc = (
    ((correctInvoiceNumbers + correctInvoiceDates + correctGstins + correctGrandTotals + correctTotalTaxes) /
      (totalDocs * 5)) *
    100
  ).toFixed(1);

  const avgLatency = Math.round(totalLatencyMs / totalDocs);
  const totalCostUsd = (totalCostMicros / 1000000).toFixed(4);
  const avgCostUsd = (totalCostMicros / totalDocs / 1000000).toFixed(4);

  console.log('\n================================================================================');
  console.log('SUMMARY METRICS:');
  console.log(`Total Documents Evaluated: ${totalDocs}`);
  console.log(`API Calls Count:           ${apiCallsCount}`);
  console.log(`Total Tokens:              ${totalTokens} (${totalInputTokens} input, ${totalOutputTokens} output)`);
  console.log(`Total Cost:                $${totalCostUsd} (${totalCostMicros} micros)`);
  console.log(`Average Cost per Invoice:  $${avgCostUsd} (${Math.round(totalCostMicros / totalDocs)} micros)`);
  console.log(`Average Latency:           ${avgLatency} ms`);
  console.log(`Invoice Number Accuracy:   ${invNoAcc}%`);
  console.log(`Invoice Date Accuracy:     ${dateAcc}%`);
  console.log(`Supplier GSTIN Accuracy:   ${gstinAcc}%`);
  console.log(`Grand Total Accuracy:      ${totalAcc}%`);
  console.log(`Total Tax Accuracy:        ${taxAcc}%`);
  console.log('--------------------------------------------------------------------------------');
  console.log(`KEY FIELD ACCURACY:        ${keyFieldAcc}% (Target: >= 90.0%)`);
  console.log('================================================================================\n');

  console.log('CONFIDENCE CALIBRATION TABLE:');
  console.log('| Confidence Bucket | Documents | Correct | Empirical Accuracy |');
  console.log('|---|---|---|---|');
  for (const [bucket, data] of Object.entries(buckets)) {
    const acc = data.total > 0 ? ((data.correct / data.total) * 100).toFixed(1) + '%' : 'N/A';
    console.log(`| ${bucket} | ${data.total} | ${data.correct} | ${acc} |`);
  }
  console.log('\nBenchmark evaluation completed.');

  if (parseFloat(keyFieldAcc) < 90.0) {
    console.error(`Accuracy target failed: ${keyFieldAcc}% < 90.0%`);
    process.exit(1);
  }
}

runEvaluation().catch((err) => {
  console.error(err);
  process.exit(1);
});
