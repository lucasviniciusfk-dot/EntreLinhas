# Preservação de snapshot truncado

## Evidência

Em `entrel_user_snapshot_v260`, o D1 continha um snapshot com exatamente 8.000.000 caracteres e `json_valid(snapshot)=0`. O registro correspondente no Supabase tem 8.848.462 caracteres e 8.849.397 bytes UTF-8.

O ID original, as 17 linhas da tabela e o valor truncado foram preservados. O Supabase não foi alterado.

## Recuperação executada em staging

- O original foi lido em nove partes, usando o ID e o `updated_at` original como condição. Se a origem mudasse durante a leitura, a operação seria interrompida.
- As partes foram gravadas sob um prefixo novo de `migration-preservation/2026-11-11/` no bucket privado existente.
- Todas as partes foram baixadas novamente, comparadas por tamanho e SHA-256 e remontadas.
- O JSON completo remontado é válido e seu hash coincide com o original:
  `527d32cf741bb7b0d38416a38d82f2a7ad73126750d93c5fccd33c5251fd6d8f`.
- Um manifesto versionado descreve ordem, tamanho e hash de cada parte.
- A tabela aditiva `snapshot_archives` vincula manifesto, ID original, dono verificado, hash e versão da origem.
- `GET /api/v1/me/snapshots/v260` exporta somente o arquivo do usuário autenticado, verificando todas as partes e o conteúdo completo antes de responder. Administradores não recebem acesso implícito ao arquivo de outra pessoa.

Os limites atuais do D1 indicam tamanho máximo de 2 MB para string/BLOB/linha; por isso o snapshot grande foi preservado no R2 com metadados no D1. [Limites oficiais](https://developers.cloudflare.com/d1/platform/limits/).

## Reversão e limites

Reverter o código do Worker não remove os objetos preservados nem altera a tabela original. Nenhum arquivo extra foi limpo.

Esta recuperação não torna os demais snapshots automaticamente equivalentes: três das outras 16 linhas ainda têm diferenças de checksum, e outros snapshots históricos também precisam de reconciliação. Os consumidores antigos que consultam diretamente a tabela Supabase ainda precisam ser migrados para o contrato de exportação.
