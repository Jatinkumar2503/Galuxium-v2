'use client';

import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, X, Sparkles } from 'lucide-react';
import { DocumentDropzone } from '@/components/upload/DocumentDropzone';
import { CsvColumnMapper } from '@/components/upload/CsvColumnMapper';

interface DashboardIngestionSectionProps {
  orgId: string;
}

export function DashboardIngestionSection({ orgId }: DashboardIngestionSectionProps) {
  const [activeTab, setActiveTab] = useState<'none' | 'invoices' | 'bank_csv'>('none');

  if (activeTab === 'none') {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-warm-charcoal text-warm-bg text-xs font-semibold hover:bg-warm-charcoal/90 transition-all shadow-sm"
        >
          <UploadCloud className="w-4 h-4 text-warm-accent" />
          <span>Upload Invoices</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('bank_csv')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-warm-sand bg-warm-surface hover:bg-warm-cream text-warm-charcoal text-xs font-semibold transition-colors shadow-sm"
        >
          <FileSpreadsheet className="w-4 h-4 text-warm-taupe" />
          <span>Import Bank CSV</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-warm-sand bg-warm-surface shadow-md p-6 space-y-5 animate-in fade-in duration-300">
      {/* Header and Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-warm-sand/60">
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl p-1 bg-warm-cream border border-warm-sand">
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'invoices'
                  ? 'bg-warm-surface text-warm-charcoal shadow-sm'
                  : 'text-warm-taupe hover:text-warm-charcoal'
              }`}
            >
              <UploadCloud className="w-3.5 h-3.5 text-warm-accent" />
              <span>Invoices & Photos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('bank_csv')}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'bank_csv'
                  ? 'bg-warm-surface text-warm-charcoal shadow-sm'
                  : 'text-warm-taupe hover:text-warm-charcoal'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-warm-taupe" />
              <span>Bank Statement CSV</span>
            </button>
          </div>

          <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-warm-taupe">
            <Sparkles className="w-3 h-3 text-warm-accent" />
            <span>Direct signed storage upload</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('none')}
          className="self-end sm:self-auto p-1.5 rounded-lg border border-warm-sand hover:bg-warm-cream text-warm-taupe hover:text-warm-charcoal transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Contents */}
      {activeTab === 'invoices' ? (
        <DocumentDropzone orgId={orgId} />
      ) : (
        <CsvColumnMapper orgId={orgId} />
      )}
    </div>
  );
}
