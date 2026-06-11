-- Track every stage change per (partner, department) pair.
-- Rows are append-only; the current stage is always the latest row.

CREATE TABLE IF NOT EXISTS partner_department_status_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id   uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  department   partner_department NOT NULL,
  stage        text NOT NULL DEFAULT '',
  changed_at   timestamptz NOT NULL DEFAULT now(),
  changed_by   uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pdsh_partner_dept
  ON partner_department_status_history (partner_id, department, changed_at);

ALTER TABLE partner_department_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff and admin manage partner_department_status_history"
  ON partner_department_status_history FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('staff', 'admin')
  ));

GRANT ALL ON partner_department_status_history TO authenticated, service_role;
GRANT SELECT ON partner_department_status_history TO anon;

-- Trigger: append a history row on every INSERT (partner added to dept)
-- and on every UPDATE where the stage actually changed.
CREATE OR REPLACE FUNCTION record_dept_status_history()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO partner_department_status_history (partner_id, department, stage, changed_by)
    VALUES (NEW.partner_id, NEW.department, NEW.stage, NEW.updated_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.stage IS DISTINCT FROM OLD.stage THEN
    INSERT INTO partner_department_status_history (partner_id, department, stage, changed_by)
    VALUES (NEW.partner_id, NEW.department, NEW.stage, NEW.updated_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER dept_status_history_trigger
  AFTER INSERT OR UPDATE ON partner_department_status
  FOR EACH ROW EXECUTE FUNCTION record_dept_status_history();
