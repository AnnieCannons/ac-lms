-- Email lists: bulk email tracking for partner outreach

CREATE TABLE IF NOT EXISTS email_lists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  subject      text NOT NULL,
  department   text NOT NULL,
  filters_used jsonb NOT NULL DEFAULT '{}',
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  sent_at      timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_list_recipients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_list_id uuid NOT NULL REFERENCES email_lists(id) ON DELETE CASCADE,
  partner_id    uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  contact_id    uuid REFERENCES partner_contacts(id) ON DELETE SET NULL,
  email         text NOT NULL,
  partner_name  text NOT NULL,
  contact_name  text,
  is_primary    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_email_lists_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER email_lists_updated_at
  BEFORE UPDATE ON email_lists
  FOR EACH ROW EXECUTE FUNCTION update_email_lists_updated_at();

ALTER TABLE email_lists           ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_list_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff and admin manage email_lists"
  ON email_lists FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff','admin'))
  );

CREATE POLICY "staff and admin manage email_list_recipients"
  ON email_list_recipients FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('staff','admin'))
  );

GRANT ALL ON email_lists           TO authenticated, service_role;
GRANT ALL ON email_list_recipients TO authenticated, service_role;
GRANT SELECT ON email_lists           TO anon;
GRANT SELECT ON email_list_recipients TO anon;
