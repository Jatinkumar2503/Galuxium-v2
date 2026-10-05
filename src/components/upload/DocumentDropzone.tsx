'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  Camera,
  FileText,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import {
  requestUploadAction,
  finalizeUploadAction,
} from '@/lib/storage/upload-actions';

export interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: 'pending' | 'requesting' | 'uploading' | 'validating' | 'complete' | 'failed';
  progress: number;
  error?: string;
  documentId?: string;
  isDuplicate?: boolean;
}

interface DocumentDropzoneProps {
  orgId: string;
  onUploadSuccess?: (documentId: string) => void;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
];

export function DocumentDropzone({ orgId, onUploadSuccess }: DocumentDropzoneProps) {
  const [items, setItems] = useState<UploadQueueItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const uploadFile = useCallback(
    async (item: UploadQueueItem) => {
      // 1. Request Signed Upload URL via Server Action
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: 'requesting', progress: 10, error: undefined } : i
        )
      );

      const requestRes = await requestUploadAction({
        orgId,
        declaredFilename: item.name,
        declaredMimeType: item.type || 'application/pdf',
        declaredSizeBytes: item.size,
      });

      if (!requestRes.success || !requestRes.signedUrl || !requestRes.documentId || !requestRes.path) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'failed',
                  error: requestRes.error || 'Failed to initiate secure upload channel.',
                }
              : i
          )
        );
        return;
      }

      const { documentId, signedUrl, path } = requestRes;

      // 2. Direct browser upload to Supabase Storage with XMLHttpRequest for progress
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: 'uploading', documentId, progress: 20 } : i
        )
      );

      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', signedUrl, true);
          xhr.setRequestHeader('Content-Type', item.type || 'application/octet-stream');

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round(20 + (e.loaded / e.total) * 60); // 20% to 80%
              setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, progress: percent } : i))
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Storage service rejected upload (${xhr.status}).`));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during storage upload.'));
          xhr.send(item.file);
        });

        // 3. Finalize upload & trigger server-side validation pipeline
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'validating', progress: 85 } : i
          )
        );

        const finalizeRes = await finalizeUploadAction({
          orgId,
          documentId,
          storagePath: path,
          declaredMimeType: item.type || 'application/pdf',
          originalFilename: item.name,
        });

        if (finalizeRes.success) {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, status: 'complete', progress: 100 } : i
            )
          );
          if (onUploadSuccess) onUploadSuccess(documentId);
        } else {
          setItems((prev) =>
            prev.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    status: 'failed',
                    error: finalizeRes.error || finalizeRes.rejectionReason || 'Validation rejected.',
                    isDuplicate: finalizeRes.isDuplicate,
                  }
                : i
            )
          );
        }
      } catch (err: unknown) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'failed',
                  error: err instanceof Error ? err.message : 'Upload transmission interrupted.',
                }
              : i
          )
        );
      }
    },
    [orgId, onUploadSuccess]
  );

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const newItems: UploadQueueItem[] = [];

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        // Enforce basic MIME check or file extension for invoices
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const isImg =
          ALLOWED_TYPES.includes(file.type) ||
          /\.(jpg|jpeg|png|heic|heif)$/i.test(file.name);

        if (!isPdf && !isImg) {
          continue;
        }

        const item: UploadQueueItem = {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
          status: 'pending',
          progress: 0,
        };
        newItems.push(item);
      }

      if (newItems.length > 0) {
        setItems((prev) => [...prev, ...newItems]);
        // Trigger uploads asynchronously
        newItems.forEach((item) => uploadFile(item));
      }
    },
    [uploadFile]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const retryItem = (item: UploadQueueItem) => {
    uploadFile(item);
  };

  return (
    <div className="w-full space-y-4">
      {/* Primary Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all text-center ${
          isDragging
            ? 'border-warm-accent bg-warm-cream/80 scale-[1.005]'
            : 'border-warm-sand hover:border-warm-taupe/80 bg-warm-surface/90'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {/* Mobile Camera Input */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div className="max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-warm-cream border border-warm-sand flex items-center justify-center text-warm-accent shadow-sm">
            <UploadCloud className="w-7 h-7" />
          </div>

          <div>
            <h3 className="font-serif font-bold text-base text-warm-charcoal">
              Upload Tax Invoices & Receipts
            </h3>
            <p className="text-xs text-warm-taupe mt-1">
              Drag & drop PDFs or photos here, or browse from your device
            </p>
            <p className="text-[11px] text-warm-taupe/80 mt-0.5">
              Supports PDF, JPEG, PNG, HEIC up to 10 MB per file
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-warm-charcoal text-warm-bg text-xs font-semibold hover:bg-warm-charcoal/90 transition-all shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-warm-accent" />
              <span>Choose Files</span>
            </button>

            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-warm-sand bg-warm-surface hover:bg-warm-cream text-warm-charcoal text-xs font-semibold transition-colors shadow-sm"
            >
              <Camera className="w-3.5 h-3.5 text-warm-taupe" />
              <span>Take Photo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Upload Queue Ledger */}
      {items.length > 0 && (
        <div className="rounded-xl border border-warm-sand bg-warm-surface overflow-hidden shadow-sm divide-y divide-warm-sand/60">
          <div className="p-3 bg-warm-cream/50 flex items-center justify-between text-xs text-warm-taupe">
            <span className="font-medium text-warm-charcoal">
              Document Ingestion Queue ({items.length})
            </span>
            <span className="text-[11px]">
              {items.filter((i) => i.status === 'complete').length} Validated ·{' '}
              {items.filter((i) => i.status === 'failed').length} Failed
            </span>
          </div>

          <div className="divide-y divide-warm-sand/40 max-h-72 overflow-y-auto">
            {items.map((item) => (
              <div key={item.id} className="p-3.5 space-y-2 hover:bg-warm-cream/20 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-warm-taupe flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-warm-charcoal truncate">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-warm-taupe">
                        {formatSize(item.size)} · {item.type.split('/')[1]?.toUpperCase() || 'FILE'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Status Pill */}
                    {item.status === 'pending' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-warm-cream border border-warm-sand text-warm-taupe">
                        Queued
                      </span>
                    )}
                    {item.status === 'requesting' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-warm-cream border border-warm-sand text-warm-accent flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Signing</span>
                      </span>
                    )}
                    {item.status === 'uploading' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-warm-cream border border-warm-sand text-warm-bronze flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>{item.progress}%</span>
                      </span>
                    )}
                    {item.status === 'validating' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-warm-cream border border-warm-sand text-warm-accent flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Validating</span>
                      </span>
                    )}
                    {item.status === 'complete' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-warm-surface border border-warm-bronze/50 text-warm-bronze flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Validated</span>
                      </span>
                    )}
                    {item.status === 'failed' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-warm-surface border border-warm-terracotta/50 text-warm-terracotta flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>{item.isDuplicate ? 'Duplicate' : 'Rejected'}</span>
                      </span>
                    )}

                    {/* Actions */}
                    {item.status === 'failed' && (
                      <button
                        type="button"
                        onClick={() => retryItem(item)}
                        title="Retry upload"
                        className="p-1 rounded hover:bg-warm-cream text-warm-charcoal transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      title="Dismiss"
                      className="p-1 rounded hover:bg-warm-cream text-warm-taupe hover:text-warm-charcoal transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                {['requesting', 'uploading', 'validating'].includes(item.status) && (
                  <div className="w-full bg-warm-sand/40 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-warm-bronze h-full transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {/* Error Banner */}
                {item.error && (
                  <p className="text-[11px] text-warm-terracotta bg-warm-cream/50 p-1.5 rounded border border-warm-sand/60">
                    {item.error}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="p-2.5 bg-warm-cream/30 text-[11px] text-warm-taupe flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-warm-bronze" />
              <span>Direct-to-storage signed channel with magic-byte verification</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
