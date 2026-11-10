# Chat no Cloudflare — staging

## Escopo desta etapa

A API de staging passa a oferecer operações autenticadas para consultar mensagens, enviar, editar, remover e reagir. O usuário é sempre identificado pelo token Supabase Auth validado pelo Worker; o cliente não escolhe o autor da operação.

Rotas:
- `GET /api/v1/chat/messages?limit=250`: lista mensagens não removidas/não apagadas e as reações associadas.
- `POST /api/v1/chat/messages`: cria mensagem e opcionalmente guarda o resumo de uma resposta em `dados.reply`.
- `PATCH /api/v1/chat/messages/:id`: edição somente pelo autor.
- `DELETE /api/v1/chat/messages/:id`: remoção lógica; autor somente até 30 minutos após criação, ou administrador confirmado.
- `PUT /api/v1/chat/messages/:id/reaction`: cria/atualiza a reação do usuário.
- `DELETE /api/v1/chat/messages/:id/reaction`: remove somente a reação do usuário autenticado.

## Segurança e compatibilidade

- Não foram copiadas as políticas RLS permissivas do Supabase.
- O Worker deriva `usuario_id` da sessão validada e verifica autoria no servidor.
- A janela de 30 minutos para remoção do autor acompanha a regra da interface legada.
- Mensagens removidas são preservadas com `removida=1` e `apagada=1`; as reações associadas são removidas para manter a experiência antiga.
- Reações usam a chave única D1 `(mensagem_id, usuario_id)`, equivalente ao índice único existente no Supabase.
- A leitura inclui mensagens fixadas, pois a interface atual separa os pins do restante após carregar. A gestão/criação/remoção de pins administrativos ainda não foi portada.
- O Supabase possui trigger `entrelinhas_push_chat_mensagens` após INSERT. D1 não executa esse trigger. Portanto, o envio de push para novas mensagens ainda não está reproduzido e esta API não deve ser considerada substituta completa do chat em produção.
- A migração não altera o HTML publicado nem direciona o frontend para esta API.

## Validação e limites

As consultas SQL foram verificadas com EXPLAIN/EXPLAIN QUERY PLAN no D1 de staging sem gravar dados. Os testes de contrato do cliente cobrem a presença dos métodos e validações locais. Não foram criadas mensagens/reacões de usuários para teste, não houve deploy do Worker e não houve alteração de dados do Supabase.

## Próximas partes do chat

1. Portar gestão administrativa de pins.
2. Definir e implementar push de mensagens sem duplicar notificações.
3. Integrar a interface principal com o cliente Cloudflare, preservando fallback/offline e evitando que filas antigas do Supabase sejam descartadas.
4. Testar com uma conta de staging antes de qualquer troca de tráfego.
