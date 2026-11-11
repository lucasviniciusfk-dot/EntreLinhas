# Migração Entre Linhas — 2026-11-11

**Ainda não aprovada para cutover de produção.** O Supabase Auth/Google permanece ativo.

## Base verificada

- PR #4 aberto, head inicial `a49da07`, sobre `main c1dd361`.
- Actions run `43037087094` falhou em `Apply guarded profile bridge`: `Profile function boundary not found; aborting.` Nenhuma alteração no HTML foi feita pelo workflow.
- Causa: o script procurava os caracteres literais `\\n` em vez da quebra de linha e ignorava CRLF.
- Os oito commits recentes de main continuam ancestrais desta branch. Sem rebase nem force push.
- Worker publicado recuperado e versionado em `worker.mjs`, com schema e índices capturados. Não se presumiu que o código estivesse no repositório.
- Endereço confirmado por HTTP: `https://entrelinhas-api-staging.lucasviniciusfk.workers.dev`. Os clientes anteriores omitiam o segundo `f`.

## Perfil implementado

- Login/bootstrap e edição real `saveProfileV166` ligados ao cliente de API.
- O canário usa `index.html?cf_profile=1`. A entrada normal mantém Supabase durante a validação com Google.
- Um escritor por conta/página. A leitura inicial pode escolher Supabase se D1 estiver indisponível; após confirmar Cloudflare, erros não provocam escrita no Supabase.
- PATCH envia apenas campos editáveis. Não atualiza XP, pontos, IDs ou papel administrativo.
- Backend valida identidade pelo Supabase Auth, moldura desbloqueada, propriedade do avatar e campos parciais. Bootstrap não concede administração a partir de metadata.
- Foto nova: upload privado R2, referência estável em D1 e Blob URL apenas para exibição autenticada.
- Campos vazios e booleanos false preservados; interface atualizada após resposta confirmada.
- Não se cria uma nova conquista ao selecionar uma moldura.

## Validação

- Testes de integração com Miniflare/workerd, D1 e R2 locais; autenticação externa é substituída explicitamente nos testes.
- Testes de cliente cobrem fonte única, falha ambígua, fallback inicial, identidade e normalização.
- Os 264 scripts inline são compilados para verificar sintaxe.
- Google real e gravação autenticada no Worker remoto ainda dependem de execução com a conta do usuário no navegador. Não foram simulados como testes remotos.

## Bloqueios de cutover

- Vários domínios e rotinas de sincronização ainda usam Supabase Data API/Storage.
- Fontes antigas de perfil em outros sincronizadores e telas sociais ainda exigem revisão antes de ativar Cloudflare globalmente.
- Comparação integral de dados e arquivos deve terminar e as diferenças devem ser reconciliadas com backup.
- Push continua dependente do webhook/Edge Function Supabase; mover leitura de notificações não comprova entrega de push.
- Nenhuma tabela, usuário, histórico, arquivo existente ou dado extra do R2 foi apagado.
