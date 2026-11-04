CREATE TABLE brief_style_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  style TEXT NOT NULL CHECK (style IN ('safe', 'bold')),
  cards_payload JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (brief_id, style)
);

ALTER TABLE brief_style_results ENABLE ROW LEVEL SECURITY;

-- Users can read style results for their own briefs only
CREATE POLICY "Users can read own style results"
  ON brief_style_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM briefs
      WHERE briefs.id = brief_style_results.brief_id
        AND briefs.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated users.
-- All writes go through the service-role client in /api/brief/style,
-- which bypasses RLS.
