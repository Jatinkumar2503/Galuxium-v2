'use client';

import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  requestUploadAction,
  finalizeUploadAction,
} from '@/lib/storage/upload-actions';

export interface ColumnMapping {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  reference: string;
}

interface CsvColumnMapperProps {
  orgId: string;
  onImportSuccess?: (documentId: string, rowCount: number) => void;
}

export function CsvColumnMapper({ orgId, onImportSuccess }: CsvColumnMapperProps) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [totalRowCount, setTotalRowCount] = useState<number>(0);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: '',
    description: '',
    debit: '',
    credit: '',
    balance: '',
    reference: '',
  });

  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'complete' | 'failed'>('upload');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [importedDocId, setImportedDocId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const detectDelimiter = (firstLine: string): string => {
    const delimiters = [',', ';', '\t', '|'];
    let best = ',';
    let maxCols = 0;
    for (const d of delimiters) {
      const count = firstLine.split(d).length;
      if (count > maxCols) {
        maxCols = count;
        best = d;
      }
    }
    return best;
  };

  const autoMapHeaders = (detectedHeaders: string[]): ColumnMapping => {
    const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const newMapping: ColumnMapping = {
      date: '',
      description: '',
      debit: '',
      credit: '',
      balance: '',
      reference: '',
    };

    for (const h of detectedHeaders) {
      const c = clean(h);
      if (!newMapping.date && (c.includes('date') || c.includes('txn') || c.includes('value'))) {
        newMapping.date = h;
      } else if (!newMapping.description && (c.includes('narr') || c.includes('desc') || c.includes('partic') || c.includes('remark'))) {
        newMapping.description = h;
      } else if (!newMapping.debit && (c.includes('debit') || c.includes('dr') || c.includes('withdrawal'))) {
        newMapping.debit = h;
      } else if (!newMapping.credit && (c.includes('credit') || c.includes('cr') || c.includes('deposit'))) {
        newMapping.credit = h;
      } else if (!newMapping.balance && (c.includes('bal') || c.includes('closing'))) {
        newMapping.balance = h;
      } else if (!newMapping.reference && (c.includes('ref') || c.includes('cheque') || c.includes('utr') || c.includes('chq'))) {
        newMapping.reference = h;
      }
    }

    return newMapping;
  };

  const parseCsvFile = async (selectedFile: File) => {
    setErrorMessage(null);

    // Max 5 MB check
    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMessage('Bank statement CSV exceeds maximum allowed limit of 5 MB.');
      return;
    }

    try {
      const text = await selectedFile.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

      if (lines.length < 2) {
        setErrorMessage('CSV file must contain a header row and at least one data transaction row.');
        return;
      }

      if (lines.length > 50000) {
        setErrorMessage(`CSV contains ${lines.length} rows, which exceeds the 50,000 rows ceiling.`);
        return;
      }

      const delimiter = detectDelimiter(lines[0]);
      const detectedHeaders = lines[0].split(delimiter).map((h) => h.replace(/^["']|["']$/g, '').trim());

      if (detectedHeaders.length < 3) {
        setErrorMessage('CSV header must contain at least 3 recognizable columns.');
        return;
      }

      const dataRows: string[][] = [];
      const previewLimit = Math.min(lines.length, 6); // header + 5 rows
      for (let i = 1; i < previewLimit; i++) {
        dataRows.push(lines[i].split(delimiter).map((col) => col.replace(/^["']|["']$/g, '').trim()));
      }

      setFile(selectedFile);
      setHeaders(detectedHeaders);
      setRows(dataRows);
      setTotalRowCount(lines.length - 1);
      setMapping(autoMapHeaders(detectedHeaders));
      setStep('mapping');
    } catch {
      setErrorMessage('Failed to read and parse CSV text. Ensure file is UTF-8 encoded.');
    }
  };

  const handleImport = async () => {
    if (!file) return;

    if (!mapping.date || !mapping.description || (!mapping.debit && !mapping.credit)) {
      setErrorMessage('Please map at least Date, Description, and Debit or Credit column before importing.');
      return;
    }

    setStep('importing');
    setUploadProgress(10);
    setErrorMessage(null);

    try {
      // 1. Request signed URL
      const reqRes = await requestUploadAction({
        orgId,
        declaredFilename: file.name,
        declaredMimeType: 'text/csv',
        declaredSizeBytes: file.size,
      });

      if (!reqRes.success || !reqRes.signedUrl || !reqRes.documentId || !reqRes.path) {
        setStep('failed');
        setErrorMessage(reqRes.error || 'Failed to create upload URL.');
        return;
      }

      setUploadProgress(30);

      // 2. Direct browser upload
      const uploadRes = await fetch(reqRes.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/csv' },
        body: file,
      });

      if (!uploadRes.ok) {
        setStep('failed');
        setErrorMessage(`Storage rejected CSV upload (${uploadRes.status}).`);
        return;
      }

      setUploadProgress(75);

      // 3. Finalize upload & validation
      const finRes = await finalizeUploadAction({
        orgId,
        documentId: reqRes.documentId,
        storagePath: reqRes.path,
        declaredMimeType: 'text/csv',
        originalFilename: file.name,
      });

      if (finRes.success) {
        setUploadProgress(100);
        setStep('complete');
        setImportedDocId(reqRes.documentId);
        if (onImportSuccess) onImportSuccess(reqRes.documentId, totalRowCount);
      } else {
        setStep('failed');
        setErrorMessage(finRes.error || finRes.rejectionReason || 'Server rejected CSV during finalize validation.');
      }
    } catch (err: unknown) {
      setStep('failed');
      setErrorMessage(err instanceof Error ? err.message : 'Import transmission failed.');
    }
  };

  const resetAll = () => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setTotalRowCount(0);
    setStep('upload');
    setErrorMessage(null);
    setUploadProgress(0);
  };

  return (
    <div className="w-full space-y-4">
      {/* Step 1: Upload Dropzone */}
      {step === 'upload' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              parseCsvFile(e.dataTransfer.files[0]);
            }
          }}
          className="border-2 border-dashed border-warm-sand hover:border-warm-taupe/80 rounded-2xl p-8 bg-warm-surface text-center space-y-4 transition-all"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                parseCsvFile(e.target.files[0]);
              }
              e.target.value = '';
            }}
          />

          <div className="w-14 h-14 mx-auto rounded-2xl bg-warm-cream border border-warm-sand flex items-center justify-center text-warm-taupe shadow-sm">
            <FileSpreadsheet className="w-7 h-7" />
          </div>

          <div>
            <h3 className="font-serif font-bold text-base text-warm-charcoal">
              Import Bank Statement CSV
            </h3>
            <p className="text-xs text-warm-taupe mt-1">
              Select or drop your exported bank statement CSV to map transaction columns
            </p>
            <p className="text-[11px] text-warm-taupe/80 mt-0.5">
              Supports UTF-8 CSV up to 5 MB (max 50,000 transactions)
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-warm-charcoal text-warm-bg text-xs font-semibold hover:bg-warm-charcoal/90 transition-all shadow-sm"
            >
              <UploadCloud className="w-4 h-4 text-warm-accent" />
              <span>Browse CSV File</span>
            </button>
          </div>

          {errorMessage && (
            <p className="text-xs text-warm-terracotta bg-warm-cream/60 p-2 rounded-lg border border-warm-sand/60">
              {errorMessage}
            </p>
          )}
        </div>
      )}

      {/* Step 2: Column Mapping & Live 5-Row Preview */}
      {step === 'mapping' && (
        <div className="space-y-5 rounded-2xl border border-warm-sand bg-warm-surface p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-warm-sand/60">
            <div>
              <h3 className="font-serif font-bold text-base text-warm-charcoal">
                Map Statement Columns
              </h3>
              <p className="text-xs text-warm-taupe mt-0.5">
                File: <span className="font-medium text-warm-charcoal">{file?.name}</span> · {totalRowCount} rows detected
              </p>
            </div>
            <button
              type="button"
              onClick={resetAll}
              className="text-xs text-warm-taupe hover:text-warm-charcoal underline"
            >
              Change file
            </button>
          </div>

          {/* Mapping Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date Column */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-warm-charcoal flex items-center justify-between">
                <span>Transaction Date *</span>
                <span className="text-[10px] text-warm-taupe">Required</span>
              </label>
              <select
                value={mapping.date}
                onChange={(e) => setMapping((m) => ({ ...m, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-warm-sand bg-warm-cream/50 text-xs text-warm-charcoal focus:outline-none focus:border-warm-accent"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Description Column */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-warm-charcoal flex items-center justify-between">
                <span>Description / Narration *</span>
                <span className="text-[10px] text-warm-taupe">Required</span>
              </label>
              <select
                value={mapping.description}
                onChange={(e) => setMapping((m) => ({ ...m, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-warm-sand bg-warm-cream/50 text-xs text-warm-charcoal focus:outline-none focus:border-warm-accent"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Debit Column */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-warm-charcoal flex items-center justify-between">
                <span>Debit / Withdrawal</span>
                <span className="text-[10px] text-warm-taupe">Optional</span>
              </label>
              <select
                value={mapping.debit}
                onChange={(e) => setMapping((m) => ({ ...m, debit: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-warm-sand bg-warm-cream/50 text-xs text-warm-charcoal focus:outline-none focus:border-warm-accent"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Credit Column */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-warm-charcoal flex items-center justify-between">
                <span>Credit / Deposit</span>
                <span className="text-[10px] text-warm-taupe">Optional</span>
              </label>
              <select
                value={mapping.credit}
                onChange={(e) => setMapping((m) => ({ ...m, credit: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-warm-sand bg-warm-cream/50 text-xs text-warm-charcoal focus:outline-none focus:border-warm-accent"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Balance Column */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-warm-charcoal flex items-center justify-between">
                <span>Running Balance</span>
                <span className="text-[10px] text-warm-taupe">Optional</span>
              </label>
              <select
                value={mapping.balance}
                onChange={(e) => setMapping((m) => ({ ...m, balance: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-warm-sand bg-warm-cream/50 text-xs text-warm-charcoal focus:outline-none focus:border-warm-accent"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Reference / UTR */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-warm-charcoal flex items-center justify-between">
                <span>Reference / UTR / Cheque</span>
                <span className="text-[10px] text-warm-taupe">Optional</span>
              </label>
              <select
                value={mapping.reference}
                onChange={(e) => setMapping((m) => ({ ...m, reference: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-warm-sand bg-warm-cream/50 text-xs text-warm-charcoal focus:outline-none focus:border-warm-accent"
              >
                <option value="">-- Select Column --</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live 5-Row Preview Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-warm-charcoal flex items-center gap-1.5">
              <span>Preview First 5 Transactions</span>
              <span className="text-[11px] text-warm-taupe font-normal">(verifying mappings)</span>
            </h4>

            <div className="border border-warm-sand rounded-xl overflow-x-auto bg-warm-cream/20">
              <table className="w-full text-left text-xs">
                <thead className="bg-warm-cream/60 border-b border-warm-sand text-warm-taupe font-medium">
                  <tr>
                    {headers.map((header) => {
                      const isMapped = Object.values(mapping).includes(header);
                      return (
                        <th
                          key={header}
                          className={`py-2.5 px-3 whitespace-nowrap ${
                            isMapped ? 'text-warm-bronze font-semibold bg-warm-cream/80' : ''
                          }`}
                        >
                          {header}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-sand/50 text-warm-charcoal">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-warm-cream/30 transition-colors">
                      {headers.map((_, colIdx) => (
                        <td key={colIdx} className="py-2 px-3 whitespace-nowrap text-[11px]">
                          {row[colIdx] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {errorMessage && (
            <p className="text-xs text-warm-terracotta bg-warm-cream/60 p-2 rounded-lg border border-warm-sand/60">
              {errorMessage}
            </p>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-warm-taupe flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-warm-bronze" />
              <span>Rows will be validated against tamper-evident audit ledger</span>
            </span>

            <button
              type="button"
              onClick={handleImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-warm-charcoal text-warm-bg text-xs font-semibold hover:bg-warm-charcoal/90 transition-all shadow-sm"
            >
              <span>Confirm & Ingest Statement</span>
              <ArrowRight className="w-3.5 h-3.5 text-warm-accent" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === 'importing' && (
        <div className="rounded-2xl border border-warm-sand bg-warm-surface p-8 text-center space-y-4">
          <Loader2 className="w-8 h-8 text-warm-bronze animate-spin mx-auto" />
          <div>
            <h4 className="font-serif font-bold text-base text-warm-charcoal">
              Ingesting Bank Statement...
            </h4>
            <p className="text-xs text-warm-taupe mt-1">
              Validating UTF-8 encoding, magic bytes, and transaction integrity
            </p>
          </div>
          <div className="max-w-xs mx-auto bg-warm-sand/40 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-warm-bronze h-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && (
        <div className="rounded-2xl border border-warm-sand bg-warm-surface p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-warm-cream border border-warm-sand flex items-center justify-center text-warm-bronze">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-base text-warm-charcoal">
              Bank Statement Ingested Successfully
            </h4>
            <p className="text-xs text-warm-taupe mt-1">
              {totalRowCount} transactions validated and queued for autonomous 3-way matching.
            </p>
            {importedDocId && (
              <p className="text-[11px] font-mono text-warm-taupe mt-1">
                Document ID: {importedDocId}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-warm-sand bg-warm-surface hover:bg-warm-cream text-warm-charcoal text-xs font-semibold transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-warm-taupe" />
            <span>Import Another Statement</span>
          </button>
        </div>
      )}

      {/* Step 5: Failed */}
      {step === 'failed' && (
        <div className="rounded-2xl border border-warm-sand bg-warm-surface p-8 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-warm-cream border border-warm-terracotta/40 flex items-center justify-center text-warm-terracotta">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-base text-warm-charcoal">
              Statement Ingestion Rejected
            </h4>
            <p className="text-xs text-warm-terracotta mt-1">
              {errorMessage || 'Validation rules rejected this file.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStep('mapping')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-warm-charcoal text-warm-bg text-xs font-semibold hover:bg-warm-charcoal/90 transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-warm-accent" />
            <span>Review & Retry</span>
          </button>
        </div>
      )}
    </div>
  );
}
