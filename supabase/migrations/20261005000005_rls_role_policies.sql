-- ==============================================================================
-- Migration: 20261005000005_rls_role_policies.sql
-- Description: Role-Based Access Control (RBAC) policies by role: owner, accountant, viewer
-- ==============================================================================

-- Helper function: get caller role in an organization
CREATE OR REPLACE FUNCTION auth_org_role(target_org_id UUID)
RETURNS TEXT AS $$
    SELECT role FROM memberships
    WHERE org_id = target_org_id AND user_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: check if caller is an active member of organization
CREATE OR REPLACE FUNCTION is_org_member(target_org_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM memberships
        WHERE org_id = target_org_id AND user_id = auth.uid()
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 1. Organizations Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "org_select_members" ON organizations
    FOR SELECT TO authenticated
    USING (is_org_member(id));

CREATE POLICY "org_update_owner" ON organizations
    FOR UPDATE TO authenticated
    USING (auth_org_role(id) = 'owner')
    WITH CHECK (auth_org_role(id) = 'owner');

-- ------------------------------------------------------------------------------
-- 2. Memberships Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "memberships_select" ON memberships
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "memberships_insert_owner" ON memberships
    FOR INSERT TO authenticated
    WITH CHECK (auth_org_role(org_id) = 'owner');

CREATE POLICY "memberships_update_owner" ON memberships
    FOR UPDATE TO authenticated
    USING (auth_org_role(org_id) = 'owner')
    WITH CHECK (auth_org_role(org_id) = 'owner');

CREATE POLICY "memberships_delete_owner" ON memberships
    FOR DELETE TO authenticated
    USING (auth_org_role(org_id) = 'owner');

-- ------------------------------------------------------------------------------
-- 3. Clients Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "clients_select_all_roles" ON clients
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "clients_insert_accountant_owner" ON clients
    FOR INSERT TO authenticated
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

CREATE POLICY "clients_update_accountant_owner" ON clients
    FOR UPDATE TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

CREATE POLICY "clients_delete_owner" ON clients
    FOR DELETE TO authenticated
    USING (auth_org_role(org_id) = 'owner');

-- ------------------------------------------------------------------------------
-- 4. Documents Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "documents_select_all_roles" ON documents
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "documents_insert_accountant_owner" ON documents
    FOR INSERT TO authenticated
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

CREATE POLICY "documents_update_accountant_owner" ON documents
    FOR UPDATE TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

CREATE POLICY "documents_delete_owner" ON documents
    FOR DELETE TO authenticated
    USING (auth_org_role(org_id) = 'owner');

-- ------------------------------------------------------------------------------
-- 5. Extractions Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "extractions_select_all_roles" ON extractions
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "extractions_write_accountant_owner" ON extractions
    FOR ALL TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

-- ------------------------------------------------------------------------------
-- 6. Bank Transactions Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "bank_tx_select_all_roles" ON bank_transactions
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "bank_tx_write_accountant_owner" ON bank_transactions
    FOR ALL TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

-- ------------------------------------------------------------------------------
-- 7. Matches Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "matches_select_all_roles" ON matches
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "matches_write_accountant_owner" ON matches
    FOR ALL TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

-- ------------------------------------------------------------------------------
-- 8. Flags Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "flags_select_all_roles" ON flags
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "flags_write_accountant_owner" ON flags
    FOR ALL TO authenticated
    USING (auth_org_role(org_id) IN ('owner', 'accountant'))
    WITH CHECK (auth_org_role(org_id) IN ('owner', 'accountant'));

-- ------------------------------------------------------------------------------
-- 9. Audit Log Policies (Append only, read by members, never updated/deleted)
-- ------------------------------------------------------------------------------
CREATE POLICY "audit_log_select_members" ON audit_log
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

CREATE POLICY "audit_log_insert" ON audit_log
    FOR INSERT TO authenticated
    WITH CHECK (is_org_member(org_id));

-- ------------------------------------------------------------------------------
-- 10. Usage Events Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "usage_events_select" ON usage_events
    FOR SELECT TO authenticated
    USING (is_org_member(org_id));

-- ------------------------------------------------------------------------------
-- 11. API Keys Policies (Owners only)
-- ------------------------------------------------------------------------------
CREATE POLICY "api_keys_owner_only" ON api_keys
    FOR ALL TO authenticated
    USING (auth_org_role(org_id) = 'owner')
    WITH CHECK (auth_org_role(org_id) = 'owner');
