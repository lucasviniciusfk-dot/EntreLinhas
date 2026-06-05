# EntreLinhas favorito online

Esta entrega usa a versao visual que voce disse que gostou: `EntreLinhas_v18_6_38_v12_reset_meta_diaria_forte(2)`.

Eu nao alterei o design nem a estrutura visual do app. A mudanca foi na camada online: a sincronizacao principal saiu do Firebase desativado e passou a usar Supabase.

## Arquivos

- `index.html`: app pronto para GitHub Pages.
- `assets/`: imagens usadas por esta versao favorita.
- `supabase-schema.sql`: tabelas, policies e buckets do Supabase.
- `.nojekyll`: evita interferencia do GitHub Pages.

## Supabase

1. Abra seu projeto no Supabase.
2. Va em SQL Editor.
3. Cole e execute `supabase-schema.sql`.
4. Confirme se existem os buckets `capas` e `epubs` em Storage.

O `index.html` ja esta apontado para o Supabase que existia nessa versao:

```js
https://rigwfejpjnrbvzfkuwgu.supabase.co
```

## GitHub Pages

1. Crie um repositorio no GitHub.
2. Envie `index.html`, `assets/`, `supabase-schema.sql`, `.nojekyll` e `README.md` para a raiz.
3. Va em Settings > Pages.
4. Escolha Deploy from a branch, branch `main`, pasta `/root`.
5. Salve e aguarde o link do GitHub Pages.

## Nota de seguranca

As policies deste SQL sao permissivas para manter o app funcionando como esta, sem mudar telas ou fluxo. Quando a parte visual estiver intocada e aprovada, o proximo passo ideal e endurecer as policies com login real por usuario.
