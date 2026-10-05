-- ==============================================================================
-- Seed Script: supabase/seed.sql
-- Description: Realistic Indian SME seed dataset with 2 orgs and 1 shared accountant
-- ==============================================================================

-- Static UUIDs for deterministic testing and foreign key linking
DO $$
DECLARE
    -- User IDs (simulating auth.users)
    user_owner_a UUID := '11111111-1111-1111-1111-111111111111';
    user_owner_b UUID := '22222222-2222-2222-2222-222222222222';
    user_accountant UUID := '33333333-3333-3333-3333-333333333333';
    user_viewer_a UUID := '44444444-4444-4444-4444-444444444444';

    -- Org IDs
    org_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    org_b UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    -- Client IDs
    client_a1 UUID := 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1';
    client_b1 UUID := 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1';

    -- Document IDs
    doc_a1 UUID := 'da111111-1111-1111-1111-111111111111';
    doc_b1 UUID := 'db111111-1111-1111-1111-111111111111';

    -- Transaction IDs
    tx_a1 UUID := 'ta111111-1111-1111-1111-111111111111';
    tx_b1 UUID := 'tb111111-1111-1111-1111-111111111111';
BEGIN
    -- 0. Create Auth Users (for foreign key satisfaction in raw Postgres CI)
    INSERT INTO auth.users (id, email)
    VALUES
        (user_owner_a, 'owner-a@bharat-electronics.in'),
        (user_owner_b, 'owner-b@deccan-logistics.in'),
        (user_accountant, 'accountant@ca-sharma.in'),
        (user_viewer_a, 'auditor@audit-india.in')
    ON CONFLICT (id) DO NOTHING;

    -- 1. Create Organizations
    INSERT INTO organizations (id, name, slug, gstin, pan, plan)
    VALUES
        (org_a, 'Bharat Electronics Pvt Ltd', 'bharat-electronics', '27AABCU9603R1ZM', 'AABCU9603R', 'pro'),
        (org_b, 'Deccan Logistics & Supply LLP', 'deccan-logistics', '29AAACD1234E1Z5', 'AAACD1234E', 'free')
    ON CONFLICT (id) DO NOTHING;

    -- 2. Create Memberships
    -- Org A: Owner A (owner), CA Sharma (accountant), Auditor (viewer)
    -- Org B: Owner B (owner), CA Sharma (accountant) [Shared accountant managing both!]
    INSERT INTO memberships (org_id, user_id, role)
    VALUES
        (org_a, user_owner_a, 'owner'),
        (org_a, user_accountant, 'accountant'),
        (org_a, user_viewer_a, 'viewer'),
        (org_b, user_owner_b, 'owner'),
        (org_b, user_accountant, 'accountant')
    ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    -- 3. Create Clients
    INSERT INTO clients (id, org_id, name, gstin, state_code, email, status)
    VALUES
        (client_a1, org_a, 'Tata AutoComp Systems Ltd', '27AAACT2727Q1ZT', '27', 'billing@tataautocomp.com', 'active'),
        (client_b1, org_b, 'Kalyani Steels Depot', '29AAACK4321F1ZX', '29', 'finance@kalyanisteels.in', 'active')
    ON CONFLICT (id) DO NOTHING;

    -- 4. Create Documents
    INSERT INTO documents (id, org_id, client_id, file_path, file_name, mime_type, file_size_bytes, content_hash, status, uploaded_by)
    VALUES
        (doc_a1, org_a, client_a1, 'org_a/2026/10/INV-001.pdf', 'INV-2026-BEL-091.pdf', 'application/pdf', 145020, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'validated', user_accountant),
        (doc_b1, org_b, client_b1, 'org_b/2026/10/INV-502.pdf', 'DECCAN-FREIGHT-502.pdf', 'application/pdf', 98400, 'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb', 'validated', user_accountant)
    ON CONFLICT (id) DO NOTHING;

    -- 5. Create Extractions
    INSERT INTO extractions (org_id, document_id, vendor_name, vendor_gstin, buyer_gstin, invoice_number, invoice_date, currency, taxable_amount, cgst_amount, sgst_amount, igst_amount, total_tax_amount, total_amount, confidence_score, line_items)
    VALUES
        (org_a, doc_a1, 'Siemens Industrial Sensors India', '27AAACS1234F1Z9', '27AABCU9603R1ZM', 'INV-2026-BEL-091', '2026-10-01', 'INR', 100000.00, 9000.00, 9000.00, 0.00, 18000.00, 118000.00, 0.9850, '[{"description": "Industrial Proximity Sensors HSN 8536", "taxable_amount": 100000.00, "gst_rate": 0.18, "total_amount": 118000.00}]'::jsonb),
        (org_b, doc_b1, 'Gati Kwe Transport Services', '29AAACG9876H1Z2', '29AAACD1234E1Z5', 'DECCAN-FREIGHT-502', '2026-10-02', 'INR', 45000.00, 4050.00, 4050.00, 0.00, 8100.00, 53100.00, 0.9620, '[{"description": "Interstate Container Freight", "taxable_amount": 45000.00, "gst_rate": 0.18, "total_amount": 53100.00}]'::jsonb)
    ON CONFLICT (document_id) DO NOTHING;

    -- 6. Create Bank Transactions
    INSERT INTO bank_transactions (id, org_id, client_id, transaction_date, description, reference_number, debit_amount, balance)
    VALUES
        (tx_a1, org_a, client_a1, '2026-10-02', 'NEFT-SIEMENS IND-HDFC000123456789', 'HDFC000123456789', 118000.00, 850400.00),
        (tx_b1, org_b, client_b1, '2026-10-03', 'RTGS-GATI KWE-ICIC000987654321', 'ICIC000987654321', 53100.00, 312000.00)
    ON CONFLICT (id) DO NOTHING;

    -- 7. Create Matches
    INSERT INTO matches (org_id, document_id, transaction_id, match_score, match_type, status, reviewer_id, review_notes)
    VALUES
        (org_a, doc_a1, tx_a1, 0.9980, 'exact', 'auto_approved', user_accountant, 'Exact match on net invoice value INR 118,000.00 and NEFT reference'),
        (org_b, doc_b1, tx_b1, 0.9750, 'exact', 'auto_approved', user_accountant, 'Auto-approved match with RTGS bank debit')
    ON CONFLICT (id) DO NOTHING;
END $$;
