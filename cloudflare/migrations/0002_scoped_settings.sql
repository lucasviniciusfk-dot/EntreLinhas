CREATE TABLE IF NOT EXISTS scoped_settings (
  scope TEXT NOT NULL CHECK(scope IN ('global','user')),
  owner_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  legacy_user_id TEXT,
  legacy_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(scope,owner_id,key)
);
CREATE INDEX IF NOT EXISTS scoped_settings_owner ON scoped_settings(owner_id,scope);
INSERT OR IGNORE INTO scoped_settings(scope,owner_id,key,value,legacy_user_id,legacy_id,active,updated_at)
SELECT 'user',usuario_id,chave,COALESCE(valor,'{}'),usuario_id,id,COALESCE(ativo,1),COALESCE(atualizado_em,criado_em,'')
FROM app_configuracoes
WHERE chave IS NOT NULL AND chave<>''
  AND usuario_id<>'global'
  AND usuario_id NOT LIKE '00000000-0000-0000-0000-000000000%';

INSERT OR IGNORE INTO scoped_settings(scope,owner_id,key,value,legacy_user_id,legacy_id,active,updated_at)
SELECT 'global','global',chave,COALESCE(valor,'{}'),usuario_id,id,COALESCE(ativo,1),COALESCE(atualizado_em,criado_em,'')
FROM (
  SELECT *,ROW_NUMBER() OVER (
    PARTITION BY chave
    ORDER BY COALESCE(atualizado_em,criado_em,'') DESC,
      CASE WHEN usuario_id='00000000-0000-0000-0000-000000000000' THEN 0
           WHEN usuario_id='00000000-0000-0000-0000-000000000181' THEN 1
           WHEN usuario_id='global' THEN 2 ELSE 3 END,
      id
  ) AS rank
  FROM app_configuracoes
  WHERE chave IS NOT NULL AND chave<>''
    AND (usuario_id='global' OR usuario_id LIKE '00000000-0000-0000-0000-000000000%')
) WHERE rank=1;
