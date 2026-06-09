# EntreLinhas v73 - PWA corrigido para GitHub Pages /EntreLinhas/

Esta versão corrige os caminhos do PWA para funcionar quando o app está publicado em um repositório de projeto do GitHub Pages, como:

https://lucasviniciusfk-dot.github.io/EntreLinhas/

## Arquivos obrigatórios na raiz do repositório

- index.html
- manifest.webmanifest
- service-worker.js
- icon-180.png
- icon-192.png
- icon-512.png
- maskable-512.png
- assets/

Os ícones também podem existir dentro de `icons/`, mas o manifesto oficial desta versão usa os ícones da raiz para evitar erro 404.

## Teste

Depois de subir no GitHub, estes links precisam abrir sem 404:

- /EntreLinhas/manifest.webmanifest
- /EntreLinhas/service-worker.js
- /EntreLinhas/icon-192.png

No Android, use Chrome > menu ⋮ > Instalar app ou Adicionar à tela inicial.
No iPhone, use Safari > Compartilhar > Adicionar à Tela de Início.
