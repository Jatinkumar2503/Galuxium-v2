'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ViewDocumentButton } from './ViewDocumentButton';
import { retryExtractionAction } from '@/lib/ai/extraction-actions';
import {
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Eye,
  ShieldAlert,
  X,
  ShieldCheck,
} from 'lucide-react';

export interface DocumentRow {
  id: string;
  org_id: string;
  file_name: string;
  file_path: string;
  status: 'pending_validation' | 'validated' | 'queued' | 'extracting' | 'extracted' | 'failed' | 'rejected';
  failure_reason?: string | null;
  extraction_version: number;
  created_at: string;
  extraction?: {
    id: string;
    version: number;
    fields: any;
    overall_confidence: number;
    needs_review: boolean;
    issues: any[];
    model: string;
    prompt_version: string;
  } | null;
}

interface LiveDocumentsLedgerProps {
  orgId: string;
  initialDocuments?: DocumentRow[];
}

export function LiveDocumentsLedger({ orgId, initialDocuments = [] }: LiveDocumentsLedgerProps) {
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocuments);
  const [selectedDoc, setSelectedDoc] = useState<DocumentRow | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [realtimeActive, setRealtimeActive] = useState<boolean>(false);

  // Fetch latest documents and associated extractions
  const refreshDocuments = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: docs, error } = await supabase
        .from('documents')
        .select(`
          id,
          org_id,
          file_name,
          file_path,
          status,
          failure_reason,
          extraction_version,
          created_at,
          extractions (
            id,
            version,
            fields,
            overall_confidence,
            needs_review,
            issues,
            model,
            prompt_version
          )
        `)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(25);

      if (!error && docs) {
        const formatted: DocumentRow[] = docs.map((d: any) => ({
          ...d,
          extraction: Array.isArray(d.extractions) && d.extractions.length > 0 ? d.extractions[0] : null,
        }));
        setDocuments(formatted);
      }
    } catch (err) {
      console.warn('Could not refresh documents:', err);
    }
  }, [orgId]);

  useEffect(() => {
    refreshDocuments();

    // Setup Supabase Realtime subscription on public.documents for orgId
    const supabase = createClient();
    const channel = supabase
      .channel(`documents-org-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `org_id=eq.${orgId}`,
        },
        () => {
          setRealtimeActive(true);
          refreshDocuments();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeActive(true);
        } else {
          setRealtimeActive(false);
        }
      });

    // Fallback: poll every 3 seconds if Realtime is inactive or disconnected (Phase 6.10)
    const interval = setInterval(() => {
      refreshDocuments();
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [orgId, refreshDocuments]);

  // Handle Retry Button Click
  const handleRetry = async (docId: string) => {
    setRetryingId(docId);
    try {
      const res = await retryExtractionAction(docId, orgId);
      if (res.success) {
        await refreshDocuments();
      } else {
        alert(`Retry failed: ${res.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRetryingId(null);
    }
  };

  // Helper formatting for currency paise -> ₹
  const formatPaise = (paise?: number) => {
    if (paise === undefined || paise === null || isNaN(paise)) return '—';
    return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="rounded-2xl border border-warm-sand bg-warm-surface shadow-sm overflow-hidden flex flex-col relative">
      {/* Table Header */}
      <div className="p-5 border-b border-warm-sand flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-serif font-bold text-warm-charcoal">
              Live Invoices & Extraction Ledger
            </h2>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                realtimeActive
                  ? 'bg-warm-cream border-warm-bronze/40 text-warm-bronze'
                  : 'bg-warm-cream border-warm-sand text-warm-taupe'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  realtimeActive ? 'bg-warm-bronze animate-pulse' : 'bg-warm-taupe'
                }`}
              />
              {realtimeActive ? 'Realtime Active' : 'Polling (3s)'}
            </span>
          </div>
          <p className="text-xs text-warm-taupe">
            Multi-stage extraction pipeline with statutory arithmetic checks and review heuristics
          </p>
        </div>
        <button
          onClick={refreshDocuments}
          className="p-1.5 text-warm-taupe hover:text-warm-charcoal rounded-lg border border-warm-sand bg-warm-cream hover:bg-warm-surface transition-colors"
          title="Refresh Ledger"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Ledger Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left text-xs">
          <thead className="bg-warm-cream/60 border-b border-warm-sand text-warm-taupe font-medium">
            <tr>
              <th className="py-3 px-4">Invoice / File</th>
              <th className="py-3 px-4">Supplier</th>
              <th className="py-3 px-4">GSTIN</th>
              <th className="py-3 px-4 text-right">Amount</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-sand/50 text-warm-charcoal">
            {documents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-warm-taupe">
                  No documents found in this organization. Upload a tax invoice above to begin extraction.
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const ext = doc.extraction?.fields;
                const supplierName = ext?.supplier?.name || '—';
                const gstin = ext?.supplier?.gstin || '—';
                const grandTotal = ext?.totals?.grand_total;

                return (
                  <tr key={doc.id} className="hover:bg-warm-cream/30 transition-colors">
                    {/* File / Invoice Number */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-warm-charcoal truncate max-w-[180px]">
                        {ext?.invoice_number || doc.file_name}
                      </div>
                      <div className="text-[10px] text-warm-taupe truncate max-w-[180px]">
                        {doc.file_name}
                      </div>
                    </td>

                    {/* Supplier */}
                    <td className="py-3 px-4 truncate max-w-[160px] text-warm-charcoal font-medium">
                      {supplierName}
                    </td>

                    {/* GSTIN */}
                    <td className="py-3 px-4 font-mono text-[11px] text-warm-taupe">
                      {gstin}
                    </td>

                    {/* Amount */}
                    <td className="py-3 px-4 text-right font-medium tabular-nums text-warm-charcoal">
                      {formatPaise(grandTotal)}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      {doc.status === 'queued' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-warm-cream border border-warm-sand text-warm-charcoal">
                          <Clock className="w-3 h-3 text-warm-taupe" />
                          Queued
                        </span>
                      )}

                      {doc.status === 'extracting' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-warm-cream border border-warm-accent/50 text-warm-charcoal">
                          <Loader2 className="w-3 h-3 text-warm-accent animate-spin" />
                          Extracting
                        </span>
                      )}

                      {doc.status === 'extracted' && (
                        <div className="flex flex-col items-center gap-0.5">
                          {doc.extraction?.needs_review ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-warm-surface border border-warm-amber/60 text-warm-charcoal">
                              <AlertTriangle className="w-3 h-3 text-warm-amber" />
                              Needs Review
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-warm-surface border border-warm-bronze/40 text-warm-bronze">
                              <CheckCircle2 className="w-3 h-3 text-warm-bronze" />
                              Extracted
                            </span>
                          )}
                          {doc.extraction?.overall_confidence !== undefined && (
                            <span className="text-[9px] text-warm-taupe font-mono">
                              {Math.round(doc.extraction.overall_confidence * 100)}% conf
                            </span>
                          )}
                        </div>
                      )}

                      {doc.status === 'validated' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-warm-surface border border-warm-bronze/40 text-warm-bronze">
                          <CheckCircle2 className="w-3 h-3 text-warm-bronze" />
                          Validated
                        </span>
                      )}

                      {doc.status === 'failed' && (
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-warm-surface border border-warm-terracotta/40 text-warm-terracotta">
                            <XCircle className="w-3 h-3 text-warm-terracotta" />
                            Failed
                          </span>
                        </div>
                      )}

                      {doc.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-warm-surface border border-warm-terracotta/40 text-warm-terracotta">
                          <XCircle className="w-3 h-3 text-warm-terracotta" />
                          Rejected
                        </span>
                      )}
                    </td>

                    {/* Actions (View, Retry, Inspect) */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Retry Button for Failed Jobs (Phase 6.10) */}
                        {doc.status === 'failed' && (
                          <button
                            onClick={() => handleRetry(doc.id)}
                            disabled={retryingId === doc.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-warm-cream border border-warm-terracotta/40 text-warm-charcoal hover:bg-warm-surface transition-colors"
                          >
                            <RefreshCw
                              className={`w-3 h-3 text-warm-terracotta ${
                                retryingId === doc.id ? 'animate-spin' : ''
                              }`}
                            />
                            Retry
                          </button>
                        )}

                        {/* Inspect Extracted Fields Button */}
                        {doc.extraction && (
                          <button
                            onClick={() => setSelectedDoc(doc)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-warm-cream border border-warm-sand text-warm-charcoal hover:bg-warm-surface transition-colors"
                          >
                            <Eye className="w-3 h-3 text-warm-accent" />
                            Inspect
                          </button>
                        )}

                        {/* View Storage Binary */}
                        <ViewDocumentButton
                          orgId={orgId}
                          documentId={doc.id}
                          filename={doc.file_name}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-warm-cream/40 border-t border-warm-sand flex items-center justify-between text-xs text-warm-taupe">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-warm-bronze" />
          <span>Statutory integer-paise arithmetic &amp; prompt-injection defenses active</span>
        </span>
        <span className="font-medium text-warm-charcoal">
          Showing {documents.length} Ledger {documents.length === 1 ? 'Record' : 'Records'}
        </span>
      </div>

      {/* SIDE PANEL / DRAWER: Extracted Fields, Issues & Confidence (Phase 6.10) */}
      {selectedDoc && selectedDoc.extraction && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-warm-charcoal/30 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedDoc(null)}
          />

          {/* Drawer Panel */}
          <div className="relative w-full max-w-xl bg-warm-bg border-l border-warm-sand shadow-2xl z-10 flex flex-col h-full overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 border-b border-warm-sand bg-warm-surface flex items-center justify-between sticky top-0 z-10">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif font-bold text-lg text-warm-charcoal">
                    Extraction Inspection
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-warm-cream border border-warm-sand text-warm-accent">
                    v{selectedDoc.extraction.version}
                  </span>
                </div>
                <p className="text-xs text-warm-taupe">
                  Model: {selectedDoc.extraction.model} ({selectedDoc.extraction.prompt_version})
                </p>
              </div>

              <button
                onClick={() => setSelectedDoc(null)}
                className="p-1.5 text-warm-taupe hover:text-warm-charcoal rounded-lg border border-warm-sand bg-warm-cream"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1 text-xs text-warm-charcoal">
              {/* Prompt Injection Warning if detected */}
              {selectedDoc.extraction.fields.suspicious_content_detected && (
                <div className="p-3.5 rounded-xl border border-warm-terracotta bg-warm-surface flex items-start gap-3">
                  <ShieldAlert className="w-5 h-5 text-warm-terracotta shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-warm-terracotta text-xs">
                      Suspicious Instructions Detected in Document
                    </h4>
                    <p className="text-[11px] text-warm-taupe mt-0.5">
                      The document attempted to inject system commands or override instructions. Prompt-injection defenses safely neutralised the payload and isolated factual values.
                    </p>
                  </div>
                </div>
              )}

              {/* Confidence & Review Banner */}
              <div className="p-4 rounded-xl border border-warm-sand bg-warm-surface flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-warm-taupe font-medium">Composite Confidence</div>
                  <div className="text-2xl font-serif font-bold text-warm-charcoal mt-0.5">
                    {Math.round(selectedDoc.extraction.overall_confidence * 100)}%
                  </div>
                </div>
                <div>
                  {selectedDoc.extraction.needs_review ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-warm-cream border border-warm-amber/60 text-warm-charcoal">
                      <AlertTriangle className="w-3.5 h-3.5 text-warm-amber" />
                      Review Required (&lt;85%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-warm-cream border border-warm-bronze/40 text-warm-bronze">
                      <CheckCircle2 className="w-3.5 h-3.5 text-warm-bronze" />
                      Statutory Compliant
                    </span>
                  )}
                </div>
              </div>

              {/* Statutory Invoice Header */}
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-warm-sand bg-warm-surface">
                <div>
                  <div className="text-[10px] text-warm-taupe uppercase font-bold tracking-wider">Invoice Number</div>
                  <div className="text-sm font-bold font-mono text-warm-charcoal mt-1">
                    {selectedDoc.extraction.fields.invoice_number || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-warm-taupe uppercase font-bold tracking-wider">Invoice Date</div>
                  <div className="text-sm font-medium font-mono text-warm-charcoal mt-1">
                    {selectedDoc.extraction.fields.invoice_date || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-warm-taupe uppercase font-bold tracking-wider">Document Type</div>
                  <div className="text-xs font-medium text-warm-charcoal capitalize mt-1">
                    {selectedDoc.extraction.fields.document_type?.replace('_', ' ') || 'Tax Invoice'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-warm-taupe uppercase font-bold tracking-wider">Place of Supply</div>
                  <div className="text-xs font-medium text-warm-charcoal mt-1">
                    State Code {selectedDoc.extraction.fields.place_of_supply || '27'}
                  </div>
                </div>
              </div>

              {/* Parties (Supplier & Buyer) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Supplier */}
                <div className="p-4 rounded-xl border border-warm-sand bg-warm-surface">
                  <div className="text-[10px] text-warm-taupe uppercase font-bold tracking-wider">Supplier (Seller)</div>
                  <div className="font-bold text-xs text-warm-charcoal mt-1">
                    {selectedDoc.extraction.fields.supplier?.name || '—'}
                  </div>
                  <div className="font-mono text-[11px] text-warm-accent mt-0.5">
                    GSTIN: {selectedDoc.extraction.fields.supplier?.gstin || '—'}
                  </div>
                  <div className="text-[11px] text-warm-taupe mt-1">
                    {selectedDoc.extraction.fields.supplier?.address || '—'}
                  </div>
                </div>

                {/* Buyer */}
                <div className="p-4 rounded-xl border border-warm-sand bg-warm-surface">
                  <div className="text-[10px] text-warm-taupe uppercase font-bold tracking-wider">Buyer (Recipient)</div>
                  <div className="font-bold text-xs text-warm-charcoal mt-1">
                    {selectedDoc.extraction.fields.buyer?.name || '—'}
                  </div>
                  <div className="font-mono text-[11px] text-warm-accent mt-0.5">
                    GSTIN: {selectedDoc.extraction.fields.buyer?.gstin || '—'}
                  </div>
                  <div className="text-[11px] text-warm-taupe mt-1">
                    {selectedDoc.extraction.fields.buyer?.address || '—'}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="rounded-xl border border-warm-sand bg-warm-surface overflow-hidden">
                <div className="p-3 bg-warm-cream/60 border-b border-warm-sand font-bold text-warm-charcoal">
                  Line Items ({selectedDoc.extraction.fields.line_items?.length || 0})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-warm-surface border-b border-warm-sand text-warm-taupe">
                      <tr>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Rate</th>
                        <th className="py-2 px-3 text-right">Taxable</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-warm-sand/50">
                      {(selectedDoc.extraction.fields.line_items || []).map((line: any, i: number) => (
                        <tr key={i} className="hover:bg-warm-cream/30">
                          <td className="py-2 px-3 font-medium text-warm-charcoal">
                            {line.description}
                            {line.hsn_sac && (
                              <span className="block text-[10px] text-warm-taupe font-mono">
                                SAC/HSN: {line.hsn_sac}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">{line.quantity}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{formatPaise(line.rate)}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{formatPaise(line.taxable_amount)}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-warm-charcoal">
                            {formatPaise(line.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals Breakdown */}
              <div className="p-4 rounded-xl border border-warm-sand bg-warm-surface space-y-2">
                <div className="flex justify-between text-xs text-warm-taupe">
                  <span>Taxable Subtotal</span>
                  <span className="font-mono text-warm-charcoal font-medium">
                    {formatPaise(selectedDoc.extraction.fields.totals?.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-warm-taupe">
                  <span>CGST</span>
                  <span className="font-mono text-warm-charcoal">
                    {formatPaise(selectedDoc.extraction.fields.totals?.cgst)}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-warm-taupe">
                  <span>SGST</span>
                  <span className="font-mono text-warm-charcoal">
                    {formatPaise(selectedDoc.extraction.fields.totals?.sgst)}
                  </span>
                </div>
                {selectedDoc.extraction.fields.totals?.igst > 0 && (
                  <div className="flex justify-between text-xs text-warm-taupe">
                    <span>IGST</span>
                    <span className="font-mono text-warm-charcoal">
                      {formatPaise(selectedDoc.extraction.fields.totals?.igst)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-warm-sand flex justify-between text-sm font-bold text-warm-charcoal">
                  <span>Grand Total</span>
                  <span className="font-mono text-warm-accent">
                    {formatPaise(selectedDoc.extraction.fields.totals?.grand_total)}
                  </span>
                </div>
              </div>

              {/* Deterministic Verification Findings & Issues */}
              <div className="rounded-xl border border-warm-sand bg-warm-surface overflow-hidden">
                <div className="p-3 bg-warm-cream/60 border-b border-warm-sand font-bold text-warm-charcoal flex items-center justify-between">
                  <span>Deterministic Audit Findings</span>
                  <span className="text-[10px] text-warm-taupe font-normal">
                    {selectedDoc.extraction.issues?.length || 0} issues reported
                  </span>
                </div>
                <div className="p-3 divide-y divide-warm-sand/50">
                  {(!selectedDoc.extraction.issues || selectedDoc.extraction.issues.length === 0) ? (
                    <div className="flex items-center gap-2 py-2 text-warm-bronze">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>All statutory math and GSTIN checks passed without issues.</span>
                    </div>
                  ) : (
                    selectedDoc.extraction.issues.map((issue: any, idx: number) => (
                      <div key={idx} className="py-2.5 flex items-start gap-2.5">
                        {issue.severity === 'error' ? (
                          <XCircle className="w-4 h-4 text-warm-terracotta shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-warm-amber shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="font-bold text-[11px] text-warm-charcoal">
                            {issue.code} ({issue.field})
                          </div>
                          <div className="text-[11px] text-warm-taupe mt-0.5">
                            {issue.message}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
