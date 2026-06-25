<p align="center">
  <img src="./icon-192.png" width="112" height="112" alt="Ícone do EntreLinhas">
</p>

<h1 align="center">EntreLinhas – Girls Book Club</h1>

<p align="center">
  Aplicativo PWA para clube do livro com leitura EPUB, metas, desafios, comunidade, recompensas, ranking, temporadas e administração integrada.
</p>

## Estado do projeto

- **Base oficial e segura:** `v469`
- **PWA / Service Worker:** `1.0.8-v469`
- **Idioma:** Português do Brasil
- **Publicação:** GitHub Pages
- **Backend:** Supabase
- **Arquivos pesados:** Cloudflare R2 por meio de Worker
- **Modo de manutenção:** evolução contínua a partir da v469

A v469 encerra o roadmap inicial e a fase de organização do aplicativo. Novas correções e funcionalidades devem partir dessa base.

## Visão geral

O EntreLinhas foi desenvolvido para administrar e acompanhar um clube do livro. O aplicativo centraliza a experiência de leitura dos membros e os processos internos do Clube em uma única PWA instalável no celular ou computador.

O sistema conecta:

- progresso de leitura;
- biblioteca pessoal e Biblioteca do Clube;
- metas diária, semanal e mensal;
- desafios automáticos e manuais;
- solicitações com comprovantes;
- XP e Estrelinhas;
- medalhas e molduras;
- ranking e temporadas;
- ciclos mensais e encontros;
- Mural, Fotos, Chat e notificações;
- administração, auditoria, testes e recuperação.

## Navegação principal

### Prólogo

Página inicial com:

- Continue lendo;
- metas diária, semanal e mensal;
- Livro do Clube;
- gêneros mais lidos;
- calendário de leitura;
- sequência de leitura;
- histórico e validação de leitura externa.

### Minha Leitura

- livros manuais;
- EPUBs pessoais;
- livros adicionados da Biblioteca do Clube;
- progresso permanente por obra;
- continuidade da página entre aparelhos;
- finalização e estatísticas;
- configurações avançadas de leitura;
- leitura em voz alta pelo sistema.

### Clube

- Livro do Clube;
- Biblioteca compartilhada;
- ciclos mensais;
- participantes e presença;
- progresso coletivo;
- Mural;
- Fotos e álbuns de encontros;
- estatísticas do Clube.

### Desafios

- desafios ativos e concluídos;
- progresso automático;
- validação manual ou mista;
- recorrência, prazo e público-alvo;
- recompensas em XP e Estrelinhas;
- histórico preservado.

### Ranking

- classificação por Estrelinhas;
- Hall da Fama;
- estatísticas;
- temporadas;
- pódio e histórico de campeãs;
- totais permanentes preservados.

## Áreas adicionais

O menu lateral reúne:

- Meu Perfil;
- Chat;
- Notificações;
- Configurações;
- Administração;
- Sair.

O perfil inclui estante pública, estatísticas, medalhas, moldura selecionada, histórico e preferências de privacidade.

## Administração

A Administração está organizada em sete grupos.

### 1. Visão geral

- Painel administrativo;
- Central de Status;
- Painel Interno de Testes.

### 2. Pessoas

- Gestão de membros;
- cargos e permissões;
- banimento e visibilidade;
- Histórico Unificado do Membro;
- solicitações e comprovantes.

### 3. Leitura e metas

- metas diária, semanal e mensal;
- desafios;
- regras, prazos, recorrência e público;
- validação externa.

### 4. Clube e conteúdo

- Biblioteca do Clube;
- ciclos;
- Mural;
- Fotos e álbuns;
- notificações administrativas;
- Gestão de Conteúdo;
- diagnóstico de registros órfãos.

### 5. Recompensas

- Central Única de Recompensas;
- medalhas e molduras;
- ranking e temporadas;
- marcadores de proteção contra duplicidade.

### 6. Segurança e auditoria

- Auditoria administrativa;
- histórico de ações;
- responsável, data, alvo e origem;
- exportação de registros.

### 7. Sistema

- cache e diagnóstico;
- dados, armazenamento e recuperação;
- backup administrativo;
- PWA e atualização;
- manual e auditoria final integrada.

## Sistema de recompensas

O aplicativo trabalha com dois saldos principais:

- **XP:** progressão interna do membro;
- **Estrelinhas:** pontuação utilizada no ranking.

As recompensas podem ser originadas por:

- meta diária;
- meta semanal;
- meta mensal;
- desafios;
- solicitações aprovadas;
- medalhas e molduras, quando configuradas;
- ciclos e eventos;
- ajustes administrativos auditados.

### Proteções contra duplicidade

O app possui camadas de proteção por regra, membro e período, incluindo:

- marcadores de conclusão;
- trava da meta semanal;
- trava da meta mensal;
- estado de processamento das solicitações;
- firewall de recompensas;
- reconciliação de medalhas e molduras;
- histórico na Central Única de Recompensas.

A interface ajuda a impedir duplicidades, mas a segurança definitiva também depende das políticas RLS e restrições do banco no Supabase.

## Leitura, progresso e obras únicas

O progresso é consolidado por obra para evitar que cópias do mesmo livro inflem páginas ou estatísticas.

A leitura alimenta:

```text
Leitor / livro manual
→ progresso por obra
→ páginas e livros finalizados
→ Continue lendo
→ calendário e sequência
→ metas e desafios
→ perfil e estatísticas
→ recompensas e ranking
```

## Validação de leitura externa

Quando a leitura acontece fora do aplicativo:

```text
Membro envia comprovante
→ arquivo enviado ao Cloudflare R2
→ solicitação registrada no Supabase
→ revisão administrativa
→ aprovação ou recusa
→ recompensa única, quando aplicável
→ notificação, histórico e auditoria
```

## Arquitetura

```text
GitHub Pages
└── index.html
    ├── interface e regras do aplicativo
    ├── Supabase JS
    ├── EPUB.js
    └── JSZip

Supabase
├── autenticação
├── banco de dados
├── políticas RLS
├── sincronização
└── notificações / Edge Function

Cloudflare Worker + R2
├── EPUBs
├── capas
├── avatares
├── fotos
└── comprovantes

Service Worker
├── shell da PWA
├── atualização segura
├── cache local controlado
├── fallback offline
└── notificações push
```

## Tecnologias

- HTML, CSS e JavaScript;
- PWA / Service Worker;
- Supabase JS v2;
- Supabase Auth e PostgREST;
- Cloudflare Worker e R2;
- EPUB.js;
- JSZip;
- GitHub Pages;
- IndexedDB e LocalStorage.

## Estrutura do repositório

```text
/
├── index.html                 # Aplicativo completo
├── service-worker.js          # Cache, atualização, offline e push
├── manifest.webmanifest       # Manifesto da PWA
├── offline.html               # Tela de contingência sem conexão
├── icon-180.png               # Ícone para Apple / navegador
├── icon-192.png               # Ícone padrão da PWA
├── icon-512.png               # Ícone de alta resolução
├── maskable-512.png           # Ícone adaptativo para Android
├── README.md                  # Documentação principal
└── relatórios e manuais       # Auditorias e documentação administrativa
```

## PWA e instalação

O EntreLinhas pode ser instalado como aplicativo.

### Android

1. Abra o endereço publicado no Chrome.
2. Use **Instalar aplicativo** ou **Adicionar à tela inicial**.
3. Abra o app pelo ícone criado.

### iPhone / iPad

1. Abra o endereço no Safari.
2. Toque em **Compartilhar**.
3. Escolha **Adicionar à Tela de Início**.

### Computador

Navegadores compatíveis exibem a opção de instalação na barra de endereço ou no menu.

## Funcionamento offline

O service worker preserva o shell local da PWA e a página de contingência. Operações compatíveis podem ficar em fila e ser reenviadas quando a conexão voltar.

O modo offline não substitui o backend. Ações que dependem de autenticação, dados ainda não carregados, upload, notificações ou confirmação do servidor aguardam conexão.

EPUBs só ficam disponíveis offline quando já foram salvos no aparelho. Dependências externas carregadas por CDN também podem exigir que tenham sido carregadas anteriormente pelo navegador.

## Egress e cache

O aplicativo reduz consultas repetidas ao Supabase por meio de cache e união de requisições simultâneas.

- **Cache global padrão:** até 45 minutos para consultas GET compatíveis;
- **Chat:** janela curta, aproximadamente 45 segundos a 1 minuto;
- **Ciclo do Clube:** aproximadamente 8 minutos;
- **painéis, recompensas e históricos:** normalmente 10 a 15 minutos;
- **dados pessoais:** janelas específicas entre poucos minutos e 30 minutos;
- **catálogos pouco alterados:** podem chegar a 6 horas.

Escritas oficiais invalidam as tabelas relacionadas. Os módulos administrativos também oferecem atualização forçada quando é necessário conferir uma mudança imediatamente.

## Offline e sincronização

```text
Ação compatível sem conexão
→ LocalStorage / IndexedDB
→ fila offline
→ conexão restabelecida
→ reenvio ao Supabase
→ invalidação do cache
→ sincronização entre aparelhos
```

A fila não deve ser usada para autenticação, RPC, EPUBs, imagens ou outros arquivos binários.

## Acessibilidade

O app oferece:

- tamanho de texto ajustável;
- alto contraste;
- redução de movimento;
- áreas de toque ampliadas;
- foco visível para teclado;
- tecla Escape em modais;
- suporte a leitores de tela;
- textos alternativos em imagens;
- barras de progresso acessíveis;
- link para pular ao conteúdo principal.

## Segurança

### Regras essenciais

- o acesso real aos dados deve ser protegido por RLS no Supabase;
- a interface administrativa não substitui as políticas do banco;
- nunca inclua `service_role`, senhas, tokens privados ou chaves secretas no `index.html`;
- a chave `anon` do Supabase é pública por definição, mas só é segura quando as políticas RLS estão corretas;
- o Worker de upload deve validar autenticação, tipo e tamanho dos arquivos;
- ações destrutivas exigem confirmação explícita;
- remoções e ajustes sensíveis devem gerar auditoria.

## Backup e recuperação

A Administração permite:

- exportar configurações e metadados em JSON;
- diagnosticar armazenamento local;
- identificar caches e filas offline;
- revisar referências do R2;
- importar um backup para conferência;
- restaurar somente `app_configuracoes` mediante confirmação.

Arquivos pesados não são incorporados ao backup JSON. Contas, leituras, saldos, recompensas e arquivos não são sobrescritos pelo fluxo conservador de restauração.

## Central de Status

Use **Administração > Visão geral > Status** para verificar:

- internet;
- sessão e cliente Supabase;
- Worker e R2;
- service worker e versão;
- caches da PWA;
- notificações push;
- filas offline;
- armazenamento local;
- cache e egress;
- integrações entre módulos;
- proteções de recompensa.

## Painel Interno de Testes

Use **Administração > Visão geral > Testes** após cada atualização.

O painel possui verificações automáticas somente leitura e roteiros manuais para:

- leitor e continuidade;
- meta diária, semanal e mensal;
- desafios;
- solicitações;
- recompensas;
- medalhas e molduras;
- ranking e temporadas;
- offline e sincronização;
- atualização da PWA.

## Publicação no GitHub Pages

### Primeira publicação

1. Coloque os arquivos na raiz do repositório.
2. Ative o GitHub Pages para a branch utilizada.
3. Aguarde a publicação por HTTPS.
4. Abra o app no navegador.
5. Verifique a Central de Status e o Painel de Testes.

### Atualização comum

Normalmente é necessário substituir:

- `index.html`;
- `service-worker.js`.

O identificador do cache no service worker deve acompanhar a nova versão.

Exemplo:

```js
const PWA_VERSION = '1.0.9-v470';
```

Também atualize o identificador esperado pelas telas de Status, Dados e Auditoria quando houver mudança de versão.

Depois do commit:

1. aguarde o GitHub Pages publicar;
2. abra o app conectado à internet;
3. aceite o aviso de atualização;
4. feche e abra novamente;
5. confira a versão na Central de Status;
6. execute o Painel Interno de Testes.

## Checklist de validação

Antes de considerar uma versão segura, teste:

- login de membro;
- login de administrador;
- leitura de livro manual;
- abertura e continuidade de EPUB;
- progresso entre dois aparelhos;
- meta diária;
- meta semanal;
- meta mensal;
- desafio automático;
- desafio com solicitação;
- aprovação e recusa;
- recompensa aplicada apenas uma vez;
- medalha e moldura;
- ranking e temporada;
- ciclo, presença e estatísticas;
- Mural, Fotos e álbuns;
- Chat e notificações;
- upload no R2;
- fila offline e reenvio;
- atualização da PWA;
- tema claro e escuro;
- recursos de acessibilidade.

## Versionamento e base segura

Cada alteração deve gerar uma nova versão numerada.

Regras recomendadas:

1. partir sempre da última base aprovada;
2. modificar apenas o escopo solicitado;
3. manter relatório de auditoria;
4. testar antes de substituir a base segura;
5. atualizar `service-worker.js` quando o `index.html` mudar;
6. preservar uma cópia da versão anterior.

A base oficial atual é:

```text
EntreLinhas_v469_DOCUMENTACAO_E_AUDITORIA_FINAL.html
```

## Considerações técnicas de manutenção

O aplicativo utiliza uma arquitetura de arquivo HTML único, construída em várias etapas. Por isso:

- não remova scripts antigos sem auditoria de dependências;
- não reorganize a ordem dos blocos de JavaScript de forma automática;
- evite formatadores que reescrevam o arquivo inteiro;
- mudanças devem ser cirúrgicas e verificadas;
- funções novas devem reutilizar os fluxos oficiais existentes;
- sistemas de recompensa não devem ser duplicados;
- alterações no cache precisam respeitar a fila offline e o service worker.

### Pontos a acompanhar em futuras manutenções

- dependências externas via CDN;
- consolidação gradual de timers e observadores legados;
- centralização das declarações do cliente Supabase;
- testes reais de concorrência entre aparelhos;
- políticas RLS e permissões do Worker;
- espaço ocupado por EPUBs, fotos e caches no dispositivo.

## Documentação complementar

O pacote inclui:

- Manual do Administrador;
- Mapa dos Sistemas Interligados;
- relatórios de auditoria;
- relatórios de verificação técnica;
- instruções de publicação.

## Autoria

Projeto desenvolvido e administrado por **Lucas Vinicius de Miranda** para o **EntreLinhas – Girls Book Club**.

## Licença

Nenhuma licença pública foi definida. Antes de distribuir ou abrir o código para terceiros, adicione um arquivo `LICENSE` com os termos desejados.
