# Notificações — API Cloudflare staging

## Contrato adicionado

- `GET /api/v1/notifications?limit=50`: lista notificações visíveis ao usuário autenticado, ordenadas por data e ID decrescentes.
- `POST /api/v1/notifications/:id/read`: marca como lida.
- `POST /api/v1/notifications/:id/hide`: oculta apenas para o usuário autenticado.

O Worker deriva o usuário da sessão Supabase validada. A visibilidade considera registros do próprio usuário, direcionados ao próprio usuário ou registros realmente globais (`usuario_id='all'` e `target_id='all'`). Notificações ocultadas são filtradas individualmente.

Para notificações globais, leitura e ocultação são armazenadas nos arrays JSON `lida_por` e `ocultada_por`; para notificações pessoais, leitura atualiza `lida`. Repetir a ação não duplica o identificador no array.

## Decisão sobre push

A criação de notificações não foi portada neste bloco. No Supabase, existe trigger após INSERT que chama serviço externo de push. Não seria seguro criar notificações diretamente no D1 sem substituir conscientemente esse efeito. Nenhuma chamada push foi feita.

## Validação

- Comparadas as colunas da tabela no Supabase e no D1 staging.
- Criadas rotas de listagem, leitura e ocultação.
- Consultas SELECT/UPDATE foram verificadas com `EXPLAIN` no D1 de staging usando IDs sintéticos; sem alterações (`changed_db=false`, `rows_written=0`).
- Métodos adicionados ao cliente: `notifications.list()`, `notifications.markRead(id)`, `notifications.hide(id)`.
- Testes locais de contrato do cliente adicionados; ainda aguardam execução automatizada e teste HTTP após deploy permitido.

## Limites

O frontend principal ainda não foi ligado a essas rotas. A semântica de notificações globais foi restringida a registros com ambos os campos `all`, evitando expor registros direcionados a outro usuário. Nenhuma tabela ou dado de produção foi alterado.
