-- Templates de mensajes/copy reusables.
-- Cada usuario puede crear sus propios snippets para reutilizar en chat,
-- comercial (post-meet, follow-ups), copy de pubs, onboarding, etc.
-- Si scope='global', son visibles para toda la agencia. scope='propio' solo
-- los ve el creador.

CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  contenido TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'otro',
  tags TEXT[] NOT NULL DEFAULT '{}',
  scope TEXT NOT NULL DEFAULT 'propio' CHECK (scope IN ('propio', 'global')),
  creado_por_id UUID REFERENCES users(id) ON DELETE SET NULL,
  use_count INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_categoria ON message_templates(categoria);
CREATE INDEX IF NOT EXISTS idx_message_templates_scope ON message_templates(scope);
CREATE INDEX IF NOT EXISTS idx_message_templates_creado_por ON message_templates(creado_por_id);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- SELECT: el creador ve los suyos, todos ven los globales.
DROP POLICY IF EXISTS "templates_select" ON message_templates;
CREATE POLICY "templates_select" ON message_templates FOR SELECT
USING (scope = 'global' OR creado_por_id = auth.uid());

-- INSERT: cualquiera puede crear los suyos (creado_por_id = auth.uid()).
DROP POLICY IF EXISTS "templates_insert" ON message_templates;
CREATE POLICY "templates_insert" ON message_templates FOR INSERT
WITH CHECK (creado_por_id = auth.uid());

-- UPDATE: solo el creador o un admin.
DROP POLICY IF EXISTS "templates_update" ON message_templates;
CREATE POLICY "templates_update" ON message_templates FOR UPDATE
USING (
  creado_por_id = auth.uid()
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND rol = 'admin')
);

-- DELETE: idem update.
DROP POLICY IF EXISTS "templates_delete" ON message_templates;
CREATE POLICY "templates_delete" ON message_templates FOR DELETE
USING (
  creado_por_id = auth.uid()
  OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND rol = 'admin')
);

COMMENT ON TABLE message_templates IS
  'Snippets de texto reusables. scope=propio: solo el creador. scope=global: toda la agencia.';
