import {DomainError,own,object,text,integer,bool,body,all,first,reply,result,identity,stamp,prepareInsert,prepareUpdate,updateRecord,rowJSON} from './http.mjs';
const fields=['titulo','autor','genero','paginas','capa','capa_url','epub_url','epub_storage_path','pagina_atual','epub_cfi','status','ativo','publico','livro_id','nome_arquivo','dados'];
const aliases={title:'titulo',author:'autor',genre:'genero',pages:'paginas',cover_url:'capa_url',current_page:'pagina_atual'};
const shape=r=>rowJSON(r,['dados'],['ativo','publico']);
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const bookData=(current,incoming)=>{const out={...object(current)};for(const[k,v]of Object.entries(object(incoming)))if(!/(?:reward|recompens|approved|aprovad|^xp$|^pontos$|^_)/i.test(k))out[k]=v;return out};
export function handleLibrary(request,env,context){
  const {uid,headers,isAdmin}=context,url=new URL(request.url),route=url.pathname.match(/^\/api\/v1\/library\/books(?:\/([^/]+))?$/),finishRequest=url.pathname.match(/^\/api\/v1\/library\/books\/([^/]+)\/finish-request$/),reading=url.pathname==='/api/v1/reading';
  if(!route&&!reading&&!finishRequest)return null;
  return result(headers,async()=>{
    if(finishRequest){
      if(request.method!=='POST')throw new DomainError('Método não permitido.',405);
      const bookId=decodeURIComponent(finishRequest[1]),b=await body(request,65536),book=await first(env.DB,'SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? AND COALESCE(ativo,1)=1',bookId,uid);
      if(!book)throw new DomainError('Livro ativo não encontrado na sua biblioteca.',404);
      if(/^(finished|finalizado|concluido|concluído)$/i.test(String(book.status||'')))throw new DomainError('Este livro já foi aprovado como finalizado.',409);
      const existing=await first(env.DB,"SELECT * FROM solicitacoes_validacao WHERE usuario_id=? AND lower(COALESCE(status,'pending')) IN ('pending','processing','pendente','processando') AND (livro_id=? OR json_extract(dados,'$.online_livro_id')=? OR json_extract(dados,'$.book_id')=?) AND (lower(COALESCE(tipo,'')) LIKE '%finish%' OR lower(COALESCE(tipo,'')) LIKE '%finaliz%') ORDER BY COALESCE(created_at,criado_em) DESC LIMIT 1",uid,book.id,book.id,book.id);
      if(existing)return reply(headers,{request:rowJSON(existing,['dados']),already_pending:true});
      const requestId=text(b.request_id||crypto.randomUUID(),128,'ID da solicitação',true),now=stamp(),user=await first(env.DB,'SELECT nome FROM usuarios WHERE id=?',uid),name=String(user?.nome||'Membro').slice(0,120),total=Math.max(1,Number(book.paginas)||1),dados={request_kind:'finish',book_id:book.id,online_livro_id:book.id,livro_titulo:book.titulo,bookTitle:book.titulo,autor:book.autor||'',paginas:total,v510:true};
      const statements=[
        env.DB.prepare("INSERT OR IGNORE INTO solicitacoes_validacao(id,usuario_id,usuario_nome,tipo,livro_id,livro_titulo,paginas,status,resenha,origem,dados,xp,pontos,created_at,updated_at,criado_em,atualizado_em) SELECT ?,?,?,?,?,?,?,'pending',?,'personal_finish_cf_v1',?,0,10,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE usuario_id=? AND lower(COALESCE(status,'pending')) IN ('pending','processing','pendente','processando') AND (livro_id=? OR json_extract(dados,'$.online_livro_id')=? OR json_extract(dados,'$.book_id')=?) AND (lower(COALESCE(tipo,'')) LIKE '%finish%' OR lower(COALESCE(tipo,'')) LIKE '%finaliz%'))").bind(requestId,uid,name,'finish',book.id,book.titulo,total,text(b.resenha||'Livro concluído. Solicitação enviada para revisão.',1000,'Resenha'),JSON.stringify(dados),now,now,now,now,uid,book.id,book.id,book.id),
        env.DB.prepare("UPDATE livros_pessoais SET status='pending_finish',pagina_atual=MAX(COALESCE(pagina_atual,0),?),progresso=100,dados=json_set(COALESCE(dados,'{}'),'$.finishPending',json('true'),'$.finishRequestId',(SELECT id FROM solicitacoes_validacao WHERE usuario_id=? AND lower(COALESCE(status,'pending')) IN ('pending','processing','pendente','processando') AND (livro_id=? OR json_extract(dados,'$.online_livro_id')=? OR json_extract(dados,'$.book_id')=?) AND (lower(COALESCE(tipo,'')) LIKE '%finish%' OR lower(COALESCE(tipo,'')) LIKE '%finaliz%') ORDER BY COALESCE(created_at,criado_em) DESC LIMIT 1),'$.finishRequestedAt',?),atualizado_em=? WHERE id=? AND usuario_id=? AND EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE usuario_id=? AND (id=? OR (livro_id=? AND status='pending')) AND (lower(COALESCE(tipo,'')) LIKE '%finish%' OR lower(COALESCE(tipo,'')) LIKE '%finaliz%'))").bind(total,uid,book.id,book.id,book.id,now,now,book.id,uid,uid,requestId,book.id)
      ];
      await env.DB.batch(statements);
      const saved=await first(env.DB,'SELECT * FROM solicitacoes_validacao WHERE id=? AND usuario_id=?',requestId,uid)||await first(env.DB,"SELECT * FROM solicitacoes_validacao WHERE usuario_id=? AND lower(COALESCE(status,'pending')) IN ('pending','processing','pendente','processando') AND (livro_id=? OR json_extract(dados,'$.online_livro_id')=? OR json_extract(dados,'$.book_id')=?) AND (lower(COALESCE(tipo,'')) LIKE '%finish%' OR lower(COALESCE(tipo,'')) LIKE '%finaliz%') ORDER BY COALESCE(created_at,criado_em) DESC LIMIT 1",uid,book.id,book.id,book.id);
      if(!saved)throw new DomainError('A solicitação não foi confirmada.',409);
      return reply(headers,{request:rowJSON(saved,['dados']),already_pending:saved.id!==requestId},saved.id===requestId?201:200);
    }
    if(request.method==='GET'){
      if(reading){const items=await all(env.DB,'SELECT * FROM leituras WHERE usuario_id=? ORDER BY atualizado_em DESC,id DESC',uid);return reply(headers,{items:items.map(r=>rowJSON(r,['dados'],['finalizado'])),count:items.length})}
      const id=route[1]?decodeURIComponent(route[1]):null,scope=url.searchParams.get('scope'),member=url.searchParams.get('member_id')||uid;
      let sql='SELECT b.* FROM livros_pessoais b JOIN usuarios u ON u.id=b.usuario_id WHERE ',args=[];
      if(scope==='all'){if(!isAdmin)throw new DomainError('Acesso administrativo necessário.',403);sql+='1=1';}
      else if(scope==='visible'){sql+="(b.usuario_id=? OR (COALESCE(b.ativo,1)=1 AND b.publico=1 AND COALESCE(u.biblioteca_publica,1)=1 AND COALESCE(u.perfil_privado,0)=0 AND COALESCE(u.apagado,0)=0 AND COALESCE(u.conta_removida,0)=0))";args.push(uid);}
      else {sql+='b.usuario_id=?';args.push(member);if(member!==uid&&!isAdmin)sql+=' AND b.publico=1 AND COALESCE(b.ativo,1)=1 AND COALESCE(u.biblioteca_publica,1)=1 AND COALESCE(u.perfil_privado,0)=0 AND COALESCE(u.apagado,0)=0 AND COALESCE(u.conta_removida,0)=0';}
      if(id){sql+=' AND b.id=?';args.push(id);}
      if(url.searchParams.get('include_inactive')!=='1'&&scope!=='all')sql+=' AND COALESCE(b.ativo,1)=1';
      const limit=Math.max(1,Math.min(500,Number(url.searchParams.get('limit'))||200)),before=url.searchParams.get('before'),beforeId=url.searchParams.get('before_id');
      if(!!before!==!!beforeId)throw new DomainError('Use before e before_id juntos.');
      if(before){sql+=" AND (COALESCE(b.atualizado_em,'')<? OR (COALESCE(b.atualizado_em,'')=? AND b.id<?))";args.push(before,before,beforeId);}
      sql+=" ORDER BY COALESCE(b.atualizado_em,'') DESC,b.id DESC LIMIT ?";args.push(limit);
      const rows=await all(env.DB,sql,...args);if(id){if(!rows[0])throw new DomainError('Livro não encontrado.',404);return reply(headers,{book:shape(rows[0])})}
      const last=rows[rows.length-1];return reply(headers,{items:rows.map(shape),count:rows.length,limit,nextCursor:rows.length===limit&&last?{before:last.atualizado_em||'',before_id:last.id}:null});
    }
    const input=await body(request),b={...input};for(const[k,v]of Object.entries(aliases))if(own(input,k))b[v]=input[k];
    identity(b,uid);
    let id=reading?text(b.book_id||b.livro_id,240,'Livro',true):text(route[1]?decodeURIComponent(route[1]):b.id||crypto.randomUUID(),128,'ID',true);
    if(!reading&&b.id&&b.id!==id)throw new DomainError('Identidade do livro não pode mudar.');
    let old=reading?await first(env.DB,'SELECT * FROM livros_pessoais WHERE usuario_id=? AND (id=? OR livro_id=?) ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END LIMIT 1',uid,id,id,id):await first(env.DB,'SELECT * FROM livros_pessoais WHERE id=?',id);
    if(old&&old.usuario_id!==uid)throw new DomainError('Livro não pertence à sua conta.',403);
    if(reading&&!old)throw new DomainError('Livro não encontrado na sua biblioteca.',404);
    if(request.method==='DELETE'){
      if(!old)return reply(headers,{removed:true,book_id:id});
      await env.DB.batch([prepareUpdate(env.DB,'livros_pessoais',{ativo:0,atualizado_em:stamp()},old.id,uid),env.DB.prepare('UPDATE book_file_assets SET deleted_at=? WHERE owner_id=? AND book_id=? AND deleted_at IS NULL').bind(stamp(),uid,old.id),env.DB.prepare('DELETE FROM library_identities WHERE owner_id=? AND book_id=?').bind(uid,old.id)]);
      return reply(headers,{removed:true,book_id:old.id});
    }
    if(!['POST','PUT','PATCH'].includes(request.method))throw new DomainError('Método não permitido.',405);
    if(!old&&request.method==='PATCH')throw new DomainError('Livro não encontrado.',404);
    const record={};for(const k of fields)if(own(b,k))record[k]=b[k];
    const now=stamp();
    if(!old){
      const title=text(b.titulo,240,'Título',true),author=text(b.autor||'',200,'Autor'),existing=await all(env.DB,'SELECT id,titulo,autor FROM livros_pessoais WHERE usuario_id=? AND COALESCE(ativo,1)=1',uid),duplicate=existing.find(r=>norm(r.titulo)===norm(title)&&norm(r.autor)===norm(author));
      if(duplicate)throw new DomainError('Este livro já está na sua biblioteca.',409);
      Object.assign(record,{id,usuario_id:uid,titulo:title,autor:author,genero:text(b.genero||'Outro',100,'Gênero'),paginas:integer(b.paginas??100,1,100000,'Páginas'),pagina_atual:0,progresso:0,status:'reading',ativo:1,publico:0,dados:{},criado_em:now});
      for(const k of fields)if(own(b,k))record[k]=b[k];
    }
    if(own(record,'titulo'))record.titulo=text(record.titulo,240,'Título',true);
    if(own(record,'autor'))record.autor=text(record.autor,200,'Autor');
    if(own(record,'genero'))record.genero=text(record.genero,100,'Gênero');
    for(const k of ['capa','capa_url','epub_url','epub_storage_path'])if(own(record,k))record[k]=text(record[k]??'',8192,k);
    if(own(record,'epub_cfi'))record.epub_cfi=text(record.epub_cfi,4096,'Posição EPUB');
    if(own(record,'nome_arquivo'))record.nome_arquivo=text(record.nome_arquivo,240,'Nome do arquivo');
    if(own(record,'livro_id'))record.livro_id=text(record.livro_id,240,'Referência do livro');
    for(const k of ['ativo','publico'])if(own(record,k))record[k]=bool(record[k],k);
    const pages=own(record,'paginas')?integer(record.paginas,1,100000,'Páginas'):Math.max(1,Number(old?.paginas)||100);if(own(record,'paginas'))record.paginas=pages;
    let page=own(record,'pagina_atual')?integer(record.pagina_atual,0,pages,'Página atual'):Number(old?.pagina_atual)||0;
    if(reading&&own(b,'current_page'))page=integer(b.current_page,0,pages,'Página atual');
    if(page>pages)throw new DomainError('Total de páginas abaixo da posição de leitura.',409);
    // Background sync cannot replace a newer reader position with an older copy.
    if((request.method==='PUT'||reading)&&old&&b.atualizado_em&&Date.parse(b.atualizado_em)<Date.parse(old.atualizado_em))return reply(headers,{book:shape(old),stale_copy_ignored:true});
    const data=bookData(old?.dados,b.dados),requested=String(b.status||old?.status||'reading');
    if(!['reading','pending_finish','finished','removed','removido','removido_admin','paused','abandoned'].includes(requested))throw new DomainError('Status inválido.');
    const approved=!!object(old?.dados).finishApprovedAt||await first(env.DB,"SELECT id FROM solicitacoes_validacao WHERE usuario_id=? AND (livro_id=? OR json_extract(dados,'$.v510_resolved_book_id')=?) AND lower(status) IN ('approved','aprovado','aprovada') LIMIT 1",uid,old?.id||id,old?.id||id);
    const status=(requested==='finished'||requested==='pending_finish')?(approved?'finished':'pending_finish'):requested;
    Object.assign(record,{pagina_atual:page,progresso:Math.round(page/pages*100),status,dados:{...data,finishPending:status==='pending_finish',_max_page:Math.max(Number(object(old?.dados)._max_page)||Number(old?.pagina_atual)||0,page)},atualizado_em:now});
    if(status==='finished')record.finalizado_em=old?.finalizado_em||now;
    const statements=[];
    const normalizedKey=norm(record.titulo||old?.titulo)+'|'+norm(record.autor??old?.autor);
    if(!old)statements.push(env.DB.prepare('INSERT OR IGNORE INTO library_identities(owner_id,normalized_key,book_id) VALUES(?,?,?)').bind(uid,normalizedKey,id));
    statements.push(old?prepareUpdate(env.DB,'livros_pessoais',record,old.id,uid):prepareInsert(env.DB,'livros_pessoais',record,{sql:'EXISTS(SELECT 1 FROM library_identities WHERE owner_id=? AND normalized_key=? AND book_id=?)',params:[uid,normalizedKey,id]}));
    if(reading||own(b,'pagina_atual')||own(b,'current_page')){
      const readId=crypto.randomUUID(),key=record.livro_id||old?.livro_id||old?.id||id,bookId=old?.id||id;
      statements.push(env.DB.prepare("INSERT INTO leituras(id,usuario_id,livro_id,pagina_atual,porcentagem,finalizado,atualizado_em,progresso,epub_cfi,status,dados) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM livros_pessoais WHERE id=? AND usuario_id=?) ON CONFLICT(usuario_id,livro_id) DO UPDATE SET pagina_atual=excluded.pagina_atual,porcentagem=excluded.porcentagem,finalizado=excluded.finalizado,atualizado_em=excluded.atualizado_em,progresso=excluded.progresso,epub_cfi=excluded.epub_cfi,status=excluded.status,dados=excluded.dados").bind(readId,uid,key,page,record.progresso,status==='finished'?1:0,now,record.progresso,record.epub_cfi??old?.epub_cfi??'',status,JSON.stringify(record.dados),bookId,uid));
    }
    await env.DB.batch(statements);
    const saved=await first(env.DB,'SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=?',old?.id||id,uid);
    if(!saved)throw new DomainError('Este livro já está na sua biblioteca.',409);
    return reply(headers,{book:shape(saved),reading:reading?rowJSON(await first(env.DB,'SELECT * FROM leituras WHERE usuario_id=? AND livro_id=?',uid,saved.livro_id||saved.id),['dados'],['finalizado']):undefined},old?200:201);
  });
}
