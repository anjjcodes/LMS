-- 001_init.sql — core schema for the License Management System

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE seat_status  AS ENUM ('ACTIVE', 'REVOKED');
CREATE TYPE audit_action AS ENUM ('POOL_CREATED', 'SEAT_ASSIGNED', 'SEAT_REVOKED');

-- ───────────────────────── organizations ─────────────────────────
CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────── admins ─────────────────────────
CREATE TABLE admins (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    email            TEXT NOT NULL UNIQUE CHECK (email = lower(btrim(email))),
    full_name        TEXT NOT NULL,
    password_hash    TEXT NOT NULL,
    role             TEXT NOT NULL DEFAULT 'ORG_ADMIN' CHECK (role IN ('ORG_ADMIN', 'ORG_VIEWER')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admins_org ON admins (organization_id);

-- ───────────────────────── api_clients (SaaS app) ─────────────────────────
CREATE TABLE api_clients (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name             TEXT NOT NULL,
    key_hash         TEXT NOT NULL UNIQUE,      -- SHA-256 hex of the API key; plaintext never stored
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────────────────── license_pools ─────────────────────────
CREATE TABLE license_pools (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name             TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    capacity         INTEGER NOT NULL CHECK (capacity > 0),
    active_seats     INTEGER NOT NULL DEFAULT 0,
    start_date       DATE NOT NULL,
    end_date         DATE NOT NULL,
    created_by       UUID NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_pool_dates        CHECK (end_date >= start_date),
    CONSTRAINT chk_pool_seats_bounds CHECK (active_seats >= 0 AND active_seats <= capacity)
);
CREATE INDEX idx_pools_org ON license_pools (organization_id, created_at DESC, id DESC);

-- ───────────────────────── seat_assignments ─────────────────────────
CREATE TABLE seat_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id         UUID NOT NULL REFERENCES license_pools(id) ON DELETE RESTRICT,
    employee_email  TEXT NOT NULL
                    CHECK (employee_email = lower(btrim(employee_email)) AND length(employee_email) <= 320),
    status          seat_status NOT NULL DEFAULT 'ACTIVE',
    assigned_by     UUID NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_by      UUID REFERENCES admins(id) ON DELETE RESTRICT,
    revoked_at      TIMESTAMPTZ,

    CONSTRAINT chk_seat_state CHECK (
        (status = 'ACTIVE'  AND revoked_at IS NULL     AND revoked_by IS NULL) OR
        (status = 'REVOKED' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL
                            AND revoked_at >= assigned_at)
    )
);

-- One ACTIVE seat per employee per pool (blocks duplicate / double-click assigns)
CREATE UNIQUE INDEX uq_active_seat_per_pool
    ON seat_assignments (pool_id, employee_email)
    WHERE status = 'ACTIVE';

-- Hot path: license verification by email
CREATE INDEX idx_seat_verify
    ON seat_assignments (employee_email)
    INCLUDE (pool_id)
    WHERE status = 'ACTIVE';

-- Admin UI: list seats in a pool, newest first
CREATE INDEX idx_seat_pool_listing
    ON seat_assignments (pool_id, status, assigned_at DESC, id DESC);

-- ───────────────────────── audit_log (append-only) ─────────────────────────
CREATE TABLE audit_log (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pool_id             UUID NOT NULL REFERENCES license_pools(id) ON DELETE RESTRICT,
    seat_assignment_id  UUID REFERENCES seat_assignments(id) ON DELETE RESTRICT,
    action              audit_action NOT NULL,
    actor_admin_id      UUID NOT NULL REFERENCES admins(id) ON DELETE RESTRICT,
    employee_email      TEXT,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    request_id          TEXT,
    metadata            JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT chk_audit_seat_actions CHECK (
        action = 'POOL_CREATED'
        OR (seat_assignment_id IS NOT NULL AND employee_email IS NOT NULL)
    )
);
CREATE INDEX idx_audit_pool_id       ON audit_log (pool_id, id DESC);
CREATE INDEX idx_audit_employee_time ON audit_log (employee_email, occurred_at DESC);

CREATE OR REPLACE FUNCTION forbid_audit_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_no_update_delete
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutation();

-- TRUNCATE bypasses row triggers; block it too so history cannot be wiped by the app role.
CREATE TRIGGER trg_audit_no_truncate
    BEFORE TRUNCATE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_audit_mutation();
