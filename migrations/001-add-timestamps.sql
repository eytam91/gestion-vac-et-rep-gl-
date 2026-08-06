-- migrations/001-add-timestamps.sql
-- Adds created_at_ts and updated_at timestamptz columns to key tables and backfills from existing text columns (if possible).
-- This file is intentionally non-destructive: it adds new columns and triggers, but does not drop or modify existing text columns.

BEGIN;

-- Add columns to users (users already has created_at as timestamp in schema but we keep safe checks)
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS created_at_ts timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add columns to employees
ALTER TABLE IF EXISTS employees
  ADD COLUMN IF NOT EXISTS created_at_ts timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill employees.created_at_ts from existing created_at text column if present and looks like ISO
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='created_at') THEN
    BEGIN
      UPDATE employees SET created_at_ts = (created_at::timestamptz) WHERE created_at IS NOT NULL AND created_at <> '';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'employees.created_at conversion skipped (non-ISO values may exist).';
    END;
  END IF;
END$$;

-- Add columns to leave_records
ALTER TABLE IF EXISTS leave_records
  ADD COLUMN IF NOT EXISTS created_at_ts timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_records' AND column_name='created_at') THEN
    BEGIN
      UPDATE leave_records SET created_at_ts = (created_at::timestamptz) WHERE created_at IS NOT NULL AND created_at <> '';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'leave_records.created_at conversion skipped (non-ISO values may exist).';
    END;
  END IF;
END$$;

-- Add columns to audit_logs
ALTER TABLE IF EXISTS audit_logs
  ADD COLUMN IF NOT EXISTS timestamp_ts timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='timestamp') THEN
    BEGIN
      UPDATE audit_logs SET timestamp_ts = (timestamp::timestamptz) WHERE timestamp IS NOT NULL AND timestamp <> '';
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'audit_logs.timestamp conversion skipped (non-ISO values may exist).';
    END;
  END IF;
END$$;

-- Trigger function to set updated_at on row modifications
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to tables that now have updated_at
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_at') THEN
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_users') THEN
        CREATE TRIGGER trg_set_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      END IF;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='updated_at') THEN
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_employees') THEN
        CREATE TRIGGER trg_set_updated_at_employees BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      END IF;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leave_records' AND column_name='updated_at') THEN
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_leave_records') THEN
        CREATE TRIGGER trg_set_updated_at_leave_records BEFORE UPDATE ON leave_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      END IF;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_logs' AND column_name='updated_at') THEN
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_set_updated_at_audit_logs') THEN
        CREATE TRIGGER trg_set_updated_at_audit_logs BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
      END IF;
    END;
  END IF;
END$$;

COMMIT;
