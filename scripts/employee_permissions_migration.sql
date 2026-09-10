-- ============================================================
-- Migration: Create employee_permissions table
-- Simple version - no complex RLS (app uses service role)
-- ============================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS employee_permissions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL,
    dairy_id    BIGINT NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, dairy_id)
);

-- 2. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_employee_permissions_dairy
    ON employee_permissions (dairy_id);

CREATE INDEX IF NOT EXISTS idx_employee_permissions_user
    ON employee_permissions (user_id);

-- 3. Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION update_employee_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employee_permissions_updated_at ON employee_permissions;
CREATE TRIGGER trg_employee_permissions_updated_at
    BEFORE UPDATE ON employee_permissions
    FOR EACH ROW EXECUTE FUNCTION update_employee_permissions_updated_at();

-- 4. Enable RLS
ALTER TABLE employee_permissions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read their own row
CREATE POLICY "employee_read_own" ON employee_permissions
    FOR SELECT
    USING (user_id = auth.uid());

-- Allow all authenticated users to insert/update (dairy-level control is in app logic)
CREATE POLICY "authenticated_write" ON employee_permissions
    FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- Done!
-- ============================================================
