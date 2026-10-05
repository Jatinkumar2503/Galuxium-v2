'use client';

import React, { useState } from 'react';
import { ExternalLink, Loader2, Eye, ShieldAlert } from 'lucide-react';
import { getSignedDocumentUrlAction } from '@/lib/storage/upload-actions';

interface ViewDocumentButtonProps {
  orgId: string;
  documentId: string;
  filename: string;
  isDownload?: boolean;
}

/**
 * Secure short-lived document access button (Phase 5.7).
 * Requests an ephemeral signed URL from the server with 300-second expiration.
 * Never leaks permanent or public storage URLs.
 */
export function ViewDocumentButton({
  orgId,
  documentId,
  filename,
  isDownload = false,
}: ViewDocumentButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAccess = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await getSignedDocumentUrlAction({
        orgId,
        documentId,
        isDownload,
      });

      if (res.success && res.signedUrl) {
        // Open short-lived signed URL in new tab
        window.open(res.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        setErrorMessage(res.error || 'Access denied by tenant storage policies.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to sign view URL.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleAccess}
        disabled={loading}
        title={`View ${filename} securely (expires in 5 mins)`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-warm-sand bg-warm-surface hover:bg-warm-cream text-warm-charcoal text-[11px] font-medium transition-colors shadow-sm disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 text-warm-accent animate-spin" />
        ) : (
          <Eye className="w-3 h-3 text-warm-taupe" />
        )}
        <span>View</span>
        <ExternalLink className="w-2.5 h-2.5 text-warm-taupe/80" />
      </button>

      {errorMessage && (
        <span
          title={errorMessage}
          className="inline-flex items-center text-[10px] text-warm-terracotta"
        >
          <ShieldAlert className="w-3 h-3" />
        </span>
      )}
    </div>
  );
}
