# Reconciliação aditiva em staging

O levantamento por chave primária encontrou oito `admin_logs` e três `metas_diarias` presentes no Supabase e ausentes no D1.

Antes da cópia, as linhas completas foram salvas em:

- `.migration-private/delta-admin_logs.backup.json`
- `.migration-private/delta-metas_diarias.backup.json`

Esses backups contêm dados privados e estão excluídos do Git.

Foram inseridas 11 linhas em `entrelinhas-staging`, preservando IDs e todas as colunas. O comando usa `INSERT ... ON CONFLICT(id) DO NOTHING`; nenhuma linha existente foi sobrescrita. JSON e booleanos foram convertidos para a representação SQLite esperada. A consulta posterior das 11 linhas confirmou equivalência de conteúdo com o backup da origem.

O banco Supabase de produção não foi modificado. Ainda existem diferenças em linhas já presentes; elas não foram sobrescritas em massa. A origem permanece ativa e pode produzir novos deltas após esta observação.

Reversão: o aplicativo continua apontando para Supabase por padrão. Não é necessário apagar os históricos copiados para reverter o canário; basta usar a entrada normal e/ou a versão anterior do Worker.
