/**
 * Galuxium Nexus V2: Generated Database Types for Supabase
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          gstin: string | null;
          pan: string | null;
          plan: 'free' | 'pro' | 'enterprise';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          gstin?: string | null;
          pan?: string | null;
          plan?: 'free' | 'pro' | 'enterprise';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          gstin?: string | null;
          pan?: string | null;
          plan?: 'free' | 'pro' | 'enterprise';
          created_at?: string;
          updated_at?: string;
        };
      };
      memberships: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role: 'owner' | 'accountant' | 'viewer';
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role: 'owner' | 'accountant' | 'viewer';
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          role?: 'owner' | 'accountant' | 'viewer';
          created_at?: string;
        };
      };
      clients: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          gstin: string | null;
          state_code: string;
          email: string | null;
          phone: string | null;
          status: 'active' | 'archived';
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          gstin?: string | null;
          state_code: string;
          email?: string | null;
          phone?: string | null;
          status?: 'active' | 'archived';
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          gstin?: string | null;
          state_code?: string;
          email?: string | null;
          phone?: string | null;
          status?: 'active' | 'archived';
          created_at?: string;
        };
      };
      documents: {
        Row: {
          id: string;
          org_id: string;
          client_id: string | null;
          file_path: string;
          file_name: string;
          mime_type: string;
          file_size_bytes: number;
          content_hash: string | null;
          status: 'pending_validation' | 'validated' | 'rejected' | 'uploaded' | 'queued' | 'extracting' | 'extracted' | 'failed';
          page_count: number | null;
          scan_status: string;
          rejection_reason: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          client_id?: string | null;
          file_path: string;
          file_name: string;
          mime_type: string;
          file_size_bytes: number;
          content_hash?: string | null;
          status?: 'pending_validation' | 'validated' | 'rejected' | 'uploaded' | 'queued' | 'extracting' | 'extracted' | 'failed';
          page_count?: number | null;
          scan_status?: string;
          rejection_reason?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          client_id?: string | null;
          file_path?: string;
          file_name?: string;
          mime_type?: string;
          file_size_bytes?: number;
          content_hash?: string | null;
          status?: 'pending_validation' | 'validated' | 'rejected' | 'uploaded' | 'queued' | 'extracting' | 'extracted' | 'failed';
          page_count?: number | null;
          scan_status?: string;
          rejection_reason?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
      };
      extractions: {
        Row: {
          id: string;
          org_id: string;
          document_id: string;
          vendor_name: string;
          vendor_gstin: string | null;
          buyer_gstin: string | null;
          invoice_number: string;
          invoice_date: string;
          due_date: string | null;
          currency: string;
          taxable_amount: number;
          cgst_amount: number;
          sgst_amount: number;
          igst_amount: number;
          total_tax_amount: number;
          total_amount: number;
          line_items: Json;
          confidence_score: number;
          field_confidences: Json;
          raw_model_output: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          document_id: string;
          vendor_name: string;
          vendor_gstin?: string | null;
          buyer_gstin?: string | null;
          invoice_number: string;
          invoice_date: string;
          due_date?: string | null;
          currency?: string;
          taxable_amount: number;
          cgst_amount?: number;
          sgst_amount?: number;
          igst_amount?: number;
          total_tax_amount: number;
          total_amount: number;
          line_items?: Json;
          confidence_score: number;
          field_confidences?: Json;
          raw_model_output?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          document_id?: string;
          vendor_name?: string;
          vendor_gstin?: string | null;
          buyer_gstin?: string | null;
          invoice_number?: string;
          invoice_date?: string;
          due_date?: string | null;
          currency?: string;
          taxable_amount?: number;
          cgst_amount?: number;
          sgst_amount?: number;
          igst_amount?: number;
          total_tax_amount?: number;
          total_amount?: number;
          line_items?: Json;
          confidence_score?: number;
          field_confidences?: Json;
          raw_model_output?: Json | null;
          created_at?: string;
        };
      };
      bank_transactions: {
        Row: {
          id: string;
          org_id: string;
          client_id: string | null;
          transaction_date: string;
          value_date: string | null;
          description: string;
          reference_number: string | null;
          debit_amount: number;
          credit_amount: number;
          balance: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          client_id?: string | null;
          transaction_date: string;
          value_date?: string | null;
          description: string;
          reference_number?: string | null;
          debit_amount?: number;
          credit_amount?: number;
          balance?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          client_id?: string | null;
          transaction_date?: string;
          value_date?: string | null;
          description?: string;
          reference_number?: string | null;
          debit_amount?: number;
          credit_amount?: number;
          balance?: number | null;
          created_at?: string;
        };
      };
      matches: {
        Row: {
          id: string;
          org_id: string;
          document_id: string;
          transaction_id: string;
          match_score: number;
          match_type: 'exact' | 'fuzzy_rule' | 'llm_assisted' | 'manual';
          status: 'auto_approved' | 'pending_review' | 'approved' | 'rejected';
          reviewer_id: string | null;
          review_notes: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          document_id: string;
          transaction_id: string;
          match_score: number;
          match_type: 'exact' | 'fuzzy_rule' | 'llm_assisted' | 'manual';
          status?: 'auto_approved' | 'pending_review' | 'approved' | 'rejected';
          reviewer_id?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          document_id?: string;
          transaction_id?: string;
          match_score?: number;
          match_type?: 'exact' | 'fuzzy_rule' | 'llm_assisted' | 'manual';
          status?: 'auto_approved' | 'pending_review' | 'approved' | 'rejected';
          reviewer_id?: string | null;
          review_notes?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
      };
      flags: {
        Row: {
          id: string;
          org_id: string;
          document_id: string;
          transaction_id: string | null;
          flag_type: 'duplicate_invoice' | 'gstin_invalid' | 'tax_mismatch' | 'date_outlier' | 'amount_mismatch' | 'split_payment';
          severity: 'info' | 'warning' | 'critical';
          explanation: string;
          is_resolved: boolean;
          resolved_by: string | null;
          resolution_notes: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          document_id: string;
          transaction_id?: string | null;
          flag_type: 'duplicate_invoice' | 'gstin_invalid' | 'tax_mismatch' | 'date_outlier' | 'amount_mismatch' | 'split_payment';
          severity: 'info' | 'warning' | 'critical';
          explanation: string;
          is_resolved?: boolean;
          resolved_by?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          document_id?: string;
          transaction_id?: string | null;
          flag_type?: 'duplicate_invoice' | 'gstin_invalid' | 'tax_mismatch' | 'date_outlier' | 'amount_mismatch' | 'split_payment';
          severity?: 'info' | 'warning' | 'critical';
          explanation?: string;
          is_resolved?: boolean;
          resolved_by?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
      };
      audit_log: {
        Row: {
          id: number;
          org_id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          details: Json;
          ip_address: string | null;
          user_agent: string | null;
          prev_hash: string | null;
          entry_hash: string;
          created_at: string;
        };
        Insert: {
          id?: number;
          org_id: string;
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id: string;
          details?: Json;
          ip_address?: string | null;
          user_agent?: string | null;
          prev_hash?: string | null;
          entry_hash?: string;
          created_at?: string;
        };
        Update: never; // Append-only! No updates permitted
      };
      usage_events: {
        Row: {
          id: string;
          org_id: string;
          event_type: 'document_processed' | 'api_call' | 'llm_tokens' | 'storage_bytes';
          quantity: number;
          cost_cents: number;
          latency_ms: number | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          event_type: 'document_processed' | 'api_call' | 'llm_tokens' | 'storage_bytes';
          quantity?: number;
          cost_cents?: number;
          latency_ms?: number | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          event_type?: 'document_processed' | 'api_call' | 'llm_tokens' | 'storage_bytes';
          quantity?: number;
          cost_cents?: number;
          latency_ms?: number | null;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      api_keys: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          scopes: string[];
          rate_limit_rpm: number;
          last_used_at: string | null;
          is_revoked: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          key_hash: string;
          key_prefix: string;
          scopes?: string[];
          rate_limit_rpm?: number;
          last_used_at?: string | null;
          is_revoked?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          key_hash?: string;
          key_prefix?: string;
          scopes?: string[];
          rate_limit_rpm?: number;
          last_used_at?: string | null;
          is_revoked?: boolean;
          created_at?: string;
        };
      };
      auth_failed_attempts: {
        Row: {
          id: string;
          email: string;
          ip_address: string;
          consecutive_failures: number;
          locked_until: string | null;
          last_attempt_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          ip_address: string;
          consecutive_failures?: number;
          locked_until?: string | null;
          last_attempt_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          ip_address?: string;
          consecutive_failures?: number;
          locked_until?: string | null;
          last_attempt_at?: string;
        };
      };
    };
  };
}
