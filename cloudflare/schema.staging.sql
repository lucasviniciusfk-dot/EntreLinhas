CREATE TABLE _cf_KV (
        key TEXT PRIMARY KEY,
        value BLOB
      ) WITHOUT ROWID;

CREATE TABLE admin_logs (id TEXT NOT NULL, admin_id TEXT, admin_nome TEXT, acao TEXT NOT NULL, detalhe TEXT, usuario_id TEXT, dados TEXT NOT NULL, criado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE albuns (id TEXT NOT NULL, nome TEXT NOT NULL, capa_url TEXT, data_encontro TEXT, livro_do_dia TEXT, dinamicas TEXT, trancado INTEGER, criado_em TEXT, PRIMARY KEY (id));

CREATE TABLE app_configuracoes (usuario_id TEXT NOT NULL, configuracoes TEXT, atualizado_em TEXT, chave TEXT, valor TEXT, ativo INTEGER, criado_em TEXT, id TEXT NOT NULL, PRIMARY KEY (usuario_id));

CREATE TABLE app_notificacoes (id TEXT NOT NULL, usuario_id TEXT, target_id TEXT, titulo TEXT NOT NULL, mensagem TEXT, tipo TEXT, lida INTEGER, lida_por TEXT, ocultada_por TEXT, origem TEXT, dados TEXT, criada_em TEXT, atualizado_em TEXT, PRIMARY KEY (id));

CREATE TABLE app_state (id TEXT NOT NULL, state TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE book_file_assets (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, book_id TEXT NOT NULL, asset_id TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('epub','cover')), created_at TEXT NOT NULL, deleted_at TEXT);

CREATE TABLE chat_mensagens (id TEXT NOT NULL, usuario_id TEXT, mensagem TEXT NOT NULL, fixada INTEGER, criado_em TEXT, editada INTEGER NOT NULL, apagada INTEGER NOT NULL, atualizado_em TEXT NOT NULL, reacoes TEXT NOT NULL, reagido_por TEXT NOT NULL, curtidas TEXT NOT NULL, nome TEXT, texto TEXT, removida INTEGER NOT NULL, dados TEXT NOT NULL, editado_em TEXT, PRIMARY KEY (id));

CREATE TABLE chat_reacoes (id TEXT NOT NULL, mensagem_id TEXT NOT NULL, usuario_id TEXT NOT NULL, emoji TEXT NOT NULL, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE clube_albuns (id TEXT NOT NULL, nome TEXT NOT NULL, data_encontro TEXT, local_encontro TEXT, livro_titulo TEXT, livro_autor TEXT, livro_capa_url TEXT, dinamicas TEXT, capa_url TEXT, trancado INTEGER NOT NULL, ativo INTEGER NOT NULL, criado_por TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE clube_biblioteca (id TEXT NOT NULL, titulo TEXT NOT NULL, autor TEXT, genero TEXT, paginas_total INTEGER NOT NULL, capa_url TEXT, epub_storage_path TEXT, nome_arquivo TEXT, ativo INTEGER NOT NULL, criado_por TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, origem_arquivo TEXT, PRIMARY KEY (id));

CREATE TABLE clube_estatisticas (id TEXT NOT NULL, dados TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE clube_fotos (id TEXT NOT NULL, album_id TEXT NOT NULL, url TEXT NOT NULL, storage_path TEXT, usuario_id TEXT, usuario_nome TEXT, ativo INTEGER NOT NULL, criado_em TEXT NOT NULL, foto_url TEXT, origem_arquivo TEXT, PRIMARY KEY (id));

CREATE TABLE clube_livro_atual (id TEXT NOT NULL, titulo TEXT NOT NULL, autor TEXT, genero TEXT, paginas_total INTEGER NOT NULL, data_encontro TEXT, horario_encontro TEXT, local_encontro TEXT, xp_recompensa INTEGER NOT NULL, capa_url TEXT, epub_storage_path TEXT, nome_arquivo TEXT, status TEXT NOT NULL, ativo INTEGER NOT NULL, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, prazo TEXT, descricao TEXT, pontos_recompensa INTEGER, PRIMARY KEY (id));

CREATE TABLE clube_livro_participantes (id TEXT NOT NULL, livro_id TEXT NOT NULL, usuario_id TEXT NOT NULL, usuario_nome TEXT, pagina_atual INTEGER NOT NULL, progresso_pct INTEGER NOT NULL, xp_recebido INTEGER NOT NULL, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, finalizado INTEGER, recompensa_recebida INTEGER, ciclo_id TEXT, PRIMARY KEY (id));

CREATE TABLE clube_livros_finalizados (id TEXT NOT NULL, titulo TEXT NOT NULL, autor TEXT, genero TEXT, paginas_total INTEGER NOT NULL, capa_url TEXT, xp_recompensa INTEGER NOT NULL, participantes INTEGER NOT NULL, ativo INTEGER NOT NULL, finalizado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE clube_mural (id TEXT NOT NULL, tipo TEXT NOT NULL, titulo TEXT NOT NULL, texto TEXT NOT NULL, fixado INTEGER NOT NULL, automatico INTEGER NOT NULL, cor TEXT, ativo INTEGER NOT NULL, autor_id TEXT, autor_nome TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE clube_mural_reacoes (id TEXT NOT NULL, post_id TEXT NOT NULL, usuario_id TEXT NOT NULL, usuario_nome TEXT, criado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE contas_removidas_app (usuario_id TEXT NOT NULL, email TEXT, removido_por TEXT, removido_em TEXT, observacao TEXT, PRIMARY KEY (usuario_id));

CREATE TABLE desafios (id TEXT NOT NULL, titulo TEXT NOT NULL, descricao TEXT, tipo TEXT, meta INTEGER, xp INTEGER, pontos INTEGER, ativo INTEGER, criado_em TEXT, meta_texto TEXT, prazo TEXT, dados TEXT NOT NULL, criado_por TEXT, atualizado_em TEXT NOT NULL, nome TEXT, meta_valor INTEGER, xp_recompensa INTEGER, pontos_recompensa INTEGER, PRIMARY KEY (id));

CREATE TABLE entrel_app_snapshot_v257 (id TEXT NOT NULL, snapshot TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE entrel_app_snapshot_v260 (id TEXT NOT NULL, updated_at TEXT NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE entrel_app_state (chave TEXT NOT NULL, valor TEXT NOT NULL, atualizado_por TEXT, atualizado_em TEXT NOT NULL, PRIMARY KEY (chave));

CREATE TABLE entrel_reward_claims_v510 (claim_key TEXT NOT NULL, usuario_id TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT, xp INTEGER NOT NULL, pontos INTEGER NOT NULL, applied INTEGER NOT NULL, created_at TEXT NOT NULL, applied_at TEXT, PRIMARY KEY (claim_key));

CREATE TABLE entrel_user_library_snapshot_v259 (usuario_id TEXT NOT NULL, updated_at TEXT NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY (usuario_id));

CREATE TABLE entrel_user_snapshot_v260 (usuario_id TEXT NOT NULL, updated_at TEXT NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY (usuario_id));

CREATE TABLE entrel_user_state (usuario_id TEXT NOT NULL, valor TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (usuario_id));

CREATE TABLE estatisticas_pessoais (usuario_id TEXT NOT NULL, paginas_lidas INTEGER NOT NULL, livros_finalizados INTEGER NOT NULL, livros_em_andamento INTEGER NOT NULL, tempo_leitura_min INTEGER NOT NULL, sequencia_atual INTEGER NOT NULL, melhor_sequencia INTEGER NOT NULL, ultimo_livro_id TEXT, dados TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (usuario_id));

CREATE TABLE file_assets (id TEXT PRIMARY KEY NOT NULL, owner_id TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, category TEXT NOT NULL CHECK (category IN ('epub','cover','avatar','club-photo','receipt')), original_name TEXT NOT NULL, content_type TEXT NOT NULL, size_bytes INTEGER NOT NULL CHECK (size_bytes > 0), created_at TEXT NOT NULL, deleted_at TEXT);

CREATE TABLE fotos_albuns (id TEXT NOT NULL, album_id TEXT, usuario_id TEXT, imagem_url TEXT NOT NULL, criado_em TEXT, PRIMARY KEY (id));

CREATE TABLE leituras (id TEXT NOT NULL, usuario_id TEXT, livro_id TEXT, pagina_atual INTEGER, porcentagem REAL, finalizado INTEGER, atualizado_em TEXT, progresso REAL, epub_cfi TEXT, status TEXT, dados TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE livro_mes (id TEXT NOT NULL, titulo TEXT NOT NULL, autor TEXT, paginas INTEGER, xp INTEGER NOT NULL, data_encontro TEXT, prazo TEXT, local TEXT, descricao TEXT, dados TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE livros (id TEXT NOT NULL, titulo TEXT NOT NULL, autor TEXT, genero TEXT, paginas INTEGER, capa_url TEXT, epub_url TEXT, livro_mes INTEGER, ativo INTEGER, criado_por TEXT, criado_em TEXT, PRIMARY KEY (id));

CREATE TABLE livros_pessoais (id TEXT NOT NULL, usuario_id TEXT, titulo TEXT NOT NULL, autor TEXT, genero TEXT, paginas INTEGER, capa_url TEXT, epub_url TEXT, pagina_atual INTEGER, progresso REAL, epub_cfi TEXT, status TEXT, ativo INTEGER, criado_em TEXT, atualizado_em TEXT, livro_id TEXT, capa TEXT, epub_storage_path TEXT, dados TEXT NOT NULL, publico INTEGER NOT NULL, finalizado_em TEXT, nome_arquivo TEXT, PRIMARY KEY (id));

CREATE TABLE medalhas (id TEXT NOT NULL, nome TEXT NOT NULL, categoria TEXT, descricao TEXT, imagem_url TEXT, regra TEXT, criado_em TEXT, PRIMARY KEY (id));

CREATE TABLE metas_diarias (id TEXT NOT NULL, usuario_id TEXT NOT NULL, data TEXT NOT NULL, meta_paginas INTEGER NOT NULL, paginas_lidas INTEGER NOT NULL, concluida INTEGER NOT NULL, recompensada INTEGER NOT NULL, origem TEXT NOT NULL, livros TEXT NOT NULL, concluida_em TEXT, atualizado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE metas_mensais (usuario_id TEXT NOT NULL, mes TEXT NOT NULL, livros_meta INTEGER NOT NULL, livros_concluidos INTEGER NOT NULL, pontos INTEGER NOT NULL, concluida INTEGER NOT NULL, dados TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (usuario_id));

CREATE TABLE metas_reset_comandos (id TEXT NOT NULL, usuario_id TEXT NOT NULL, data TEXT NOT NULL, meta_paginas INTEGER NOT NULL, feito_por TEXT, criado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE metas_usuarios (usuario_id TEXT NOT NULL, meta_atual INTEGER NOT NULL, melhor_meta INTEGER NOT NULL, concluidas INTEGER NOT NULL, sequencia INTEGER NOT NULL, melhor_sequencia INTEGER NOT NULL, resetado_em TEXT, atualizado_em TEXT NOT NULL, meta_diaria INTEGER, paginas_lidas_hoje INTEGER, meta_concluida INTEGER, concluida INTEGER, status TEXT, data_atual TEXT, PRIMARY KEY (usuario_id));

CREATE TABLE molduras (id TEXT NOT NULL, nome TEXT NOT NULL, imagem_url TEXT, descricao TEXT, regra TEXT, criado_em TEXT, slug TEXT, icone TEXT, requisito TEXT, origem TEXT NOT NULL, ordem INTEGER NOT NULL, ativa INTEGER NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE notificacoes (id TEXT NOT NULL, usuario_id TEXT, titulo TEXT NOT NULL, mensagem TEXT, lida INTEGER, criado_em TEXT, PRIMARY KEY (id));

CREATE TABLE push_subscriptions (id TEXT NOT NULL, usuario_id TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT, ativo INTEGER NOT NULL, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE ranking_recordes (tipo TEXT NOT NULL, atual_usuario_id TEXT, atual_nome TEXT, atual_valor INTEGER NOT NULL, anterior_usuario_id TEXT, anterior_nome TEXT, anterior_valor INTEGER NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (tipo));

CREATE TABLE ranking_snapshots (id TEXT NOT NULL, data TEXT NOT NULL, usuario_id TEXT NOT NULL, nome TEXT, posicao INTEGER, pontos INTEGER NOT NULL, livros INTEGER NOT NULL, paginas INTEGER NOT NULL, medalhas INTEGER NOT NULL, sequencia INTEGER NOT NULL, nivel INTEGER NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE ranking_temporada_entries (id TEXT NOT NULL, temporada_id TEXT, usuario_id TEXT, nome TEXT, posicao INTEGER, pontos INTEGER NOT NULL, livros INTEGER NOT NULL, paginas INTEGER NOT NULL, medalhas INTEGER NOT NULL, sequencia INTEGER NOT NULL, nivel INTEGER NOT NULL, criado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE ranking_temporadas (id TEXT NOT NULL, nome TEXT NOT NULL, status TEXT NOT NULL, ativa INTEGER NOT NULL, iniciado_em TEXT NOT NULL, encerrado_em TEXT, criado_por TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, data_inicio TEXT, inicio TEXT, data_fim TEXT, fim TEXT, auto_reset INTEGER, reset_automatico INTEGER, resetar_estrelas_no_fim INTEGER, resetar_xp_no_fim INTEGER, resetado_em TEXT, PRIMARY KEY (id));

CREATE TABLE solicitacoes_validacao (id TEXT NOT NULL, usuario_id TEXT NOT NULL, usuario_nome TEXT, tipo TEXT NOT NULL, livro_id TEXT, livro_titulo TEXT, paginas INTEGER, prova TEXT, status TEXT NOT NULL, resposta_admin TEXT, revisado_por TEXT, criado_em TEXT NOT NULL, revisado_em TEXT, dados TEXT NOT NULL, desafio_id TEXT, livro TEXT, resenha TEXT, comprovante TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, titulo TEXT, descricao TEXT, atualizado_em TEXT, origem TEXT, meta_tipo TEXT, texto_resenha TEXT, mensagem TEXT, imagem_url TEXT, foto_url TEXT, print_url TEXT, comprovante_url TEXT, imagens TEXT, anexos TEXT, xp INTEGER NOT NULL, pontos INTEGER NOT NULL, PRIMARY KEY (id));

CREATE TABLE usuario_desafios (id TEXT NOT NULL, usuario_id TEXT, desafio_id TEXT, progresso INTEGER, concluido INTEGER, concluido_em TEXT, status TEXT NOT NULL, dados TEXT NOT NULL, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL, PRIMARY KEY (id));

CREATE TABLE usuario_medalhas (id TEXT NOT NULL, usuario_id TEXT, medalha_id TEXT, conquistada_em TEXT, PRIMARY KEY (id));

CREATE TABLE usuario_molduras (id TEXT NOT NULL, usuario_id TEXT, moldura_id TEXT, desbloqueada_em TEXT, nome TEXT, origem TEXT, ativa INTEGER, criado_em TEXT, atualizado_em TEXT, dados TEXT, PRIMARY KEY (id));

CREATE TABLE usuarios (id TEXT NOT NULL, nome TEXT, email TEXT, foto_url TEXT, bio TEXT, livro_favorito TEXT, nivel INTEGER, xp INTEGER, paginas_lidas INTEGER, livros_finalizados INTEGER, sequencia_dias INTEGER, moldura_ativa TEXT, is_admin INTEGER, perfil_privado INTEGER, criado_em TEXT, estado TEXT NOT NULL, pontos INTEGER NOT NULL, biblioteca_publica INTEGER NOT NULL, moldura_atual TEXT NOT NULL, medalhas_manuais TEXT NOT NULL, medalhas_evento TEXT NOT NULL, medalhas_secretas TEXT NOT NULL, historico_medalhas TEXT NOT NULL, historico_molduras TEXT NOT NULL, ultima_hora_leitura INTEGER, atualizado_em TEXT NOT NULL, banido INTEGER, banned INTEGER, ban_motivo TEXT, banido_em TEXT, banido_por TEXT, oculto_publico INTEGER, admin_principal INTEGER, apagado INTEGER, conta_removida INTEGER, removido_em TEXT, removido_por TEXT, PRIMARY KEY (id));
