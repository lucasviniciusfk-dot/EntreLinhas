import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './runtime.mjs';
let r;before(async()=>r=await runtime());after(async()=>await r?.close());
test('preferences preserve a different legacy key and independent scoped settings',async()=>{
  await r.insert('app_configuracoes',{usuario_id:'alice',id:'legacy',chave:'old_reward_claim',valor:'{"paid":true}',configuracoes:'{"theme":"claro"}'});
  assert.equal((await r.api('/api/v1/settings/user/preferences','alice','PUT',{configuracoes:{theme:'escuro',notificationsChat:false}})).status,200);
  const legacy=await r.db.prepare('SELECT * FROM app_configuracoes WHERE usuario_id=?').bind('alice').first();
  assert.equal(legacy.chave,'old_reward_claim');assert.equal(legacy.valor,'{"paid":true}');assert.equal(JSON.parse(legacy.configuracoes).notificationsChat,false);
  for(const key of ['reader_a','reader_b'])assert.equal((await r.api('/api/v1/settings/user/'+key,'alice','PUT',{value:{size:120}})).status,200);
  const own=await (await r.api('/api/v1/settings')).json();assert.ok(own.items.some(x=>x.chave==='reader_a'));assert.ok(own.items.some(x=>x.chave==='reader_b'));
  const other=await (await r.api('/api/v1/settings','bob')).json();assert.equal(other.items.some(x=>x.usuario_id==='alice'),false);
});
test('global settings and reward markers require distinct permissions',async()=>{
  assert.equal((await r.api('/api/v1/settings/global/meta_semanal','alice','PUT',{value:{target:1}})).status,403);
  assert.equal((await r.api('/api/v1/settings/user/reward_claim_fake','alice','PUT',{value:{paid:true}})).status,403);
  assert.equal((await r.api('/api/v1/settings/global/meta_semanal','admin','PUT',{value:{target:100}})).status,200);
});
test('global settings update the matching canonical legacy row without changing sibling sentinels',async()=>{
  await r.insert('app_configuracoes',{id:'weekly-old',usuario_id:'00000000-0000-0000-0000-000000000000',chave:'new_global_key',valor:'{"target":5}',ativo:1,atualizado_em:'2026-01-01T00:00:00Z'});
  await r.insert('app_configuracoes',{id:'weekly-current',usuario_id:'00000000-0000-0000-0000-000000000181',chave:'new_global_key',valor:'{"target":10}',ativo:1,atualizado_em:'2026-02-01T00:00:00Z'});
  assert.equal((await r.api('/api/v1/settings/global/new_global_key','admin','PUT',{value:{target:20}})).status,200);
  const old=await r.db.prepare('SELECT valor FROM app_configuracoes WHERE id=?').bind('weekly-old').first(),current=await r.db.prepare('SELECT valor FROM app_configuracoes WHERE id=?').bind('weekly-current').first();
  assert.equal(old.valor,'{"target":5}');assert.equal(JSON.parse(current.valor).target,20);
});
test('book IDs, partial fields and linked reading IDs are preserved',async()=>{
  const created=await r.api('/api/v1/library/books','alice','POST',{id:'book-stable',livro_id:'logical-stable',titulo:'Duna',autor:'Herbert',paginas:200,publico:true,dados:{custom:'kept',reward_applied:true}});
  assert.equal(created.status,201,await created.clone().text());
  const row=(await created.json()).book;assert.equal(row.id,'book-stable');assert.equal(row.dados.custom,'kept');assert.equal(row.dados.reward_applied,undefined);
  const update=await r.api('/api/v1/library/books/book-stable','alice','PATCH',{genero:'Ficção'});
  assert.equal(update.status,200);assert.equal((await update.json()).book.titulo,'Duna');
  const revision=(await r.db.prepare('SELECT atualizado_em FROM livros_pessoais WHERE id=?').bind('book-stable').first()).atualizado_em;
  const read=await r.api('/api/v1/reading','alice','POST',{book_id:'book-stable',current_page:40,epub_cfi:'epubcfi(/6)',atualizado_em:revision});
  assert.equal(read.status,200);assert.equal((await read.json()).reading.livro_id,'logical-stable');
  const stale=await r.api('/api/v1/reading','alice','POST',{book_id:'book-stable',current_page:10,atualizado_em:revision});assert.equal(stale.status,200);assert.equal((await stale.json()).stale_copy_ignored,true);
  assert.equal((await r.db.prepare('SELECT pagina_atual FROM livros_pessoais WHERE id=?').bind('book-stable').first()).pagina_atual,40);
  assert.equal((await r.db.prepare('SELECT count(*) AS n FROM leituras WHERE usuario_id=?').bind('alice').first()).n,1);
  assert.equal((await r.api('/api/v1/library/books/book-stable','bob','PATCH',{titulo:'Steal'})).status,403);
});
test('concurrent duplicate creation creates one book and no orphan reading',async()=>{
  const results=await Promise.all(Array.from({length:5},(_,i)=>r.api('/api/v1/library/books','alice','POST',{id:'duplicate-'+i,titulo:'Único',autor:'Autor',paginas:100,pagina_atual:5})));
  assert.equal(results.filter(x=>x.status===201).length,1);
  assert.equal((await r.db.prepare("SELECT count(*) AS n FROM livros_pessoais WHERE titulo='Único'").first()).n,1);
  assert.equal((await r.db.prepare("SELECT count(*) AS n FROM leituras WHERE livro_id LIKE 'duplicate-%'").first()).n,1);
});
test('finish requests are idempotent and award nothing until an admin approves',async()=>{
  const created=await r.api('/api/v1/library/books','alice','POST',{id:'finish-book',livro_id:'finish-book',titulo:'Fim de ciclo',autor:'A. Pessoa',paginas:40});assert.equal(created.status,201);
  await r.insert('solicitacoes_validacao',{id:'daily-unrelated',usuario_id:'alice',tipo:'daily',livro_id:'finish-book',status:'pending',dados:'{}',created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-01T00:00:00Z'});
  const attempts=await Promise.all(['request-one','request-two','request-one'].map(request_id=>r.api('/api/v1/library/books/finish-book/finish-request','alice','POST',{request_id,resenha:'Concluído.'})));
  for(const response of attempts)assert.ok([200,201].includes(response.status),await response.clone().text());
  const requests=await r.db.prepare("SELECT * FROM solicitacoes_validacao WHERE usuario_id='alice' AND (livro_id='finish-book' OR json_extract(dados,'$.online_livro_id')='finish-book') AND lower(tipo) LIKE '%finish%' AND status='pending'").all();
  assert.equal(requests.results.length,1);assert.equal((await r.db.prepare("SELECT pontos FROM usuarios WHERE id='alice'").first()).pontos,20);
  const queue=await r.api('/api/v1/admin/requests?status=pending&source=personal_finish_cf_v1','admin');assert.equal(queue.status,200);assert.deepEqual((await queue.json()).items.map(x=>x.id),[requests.results[0].id]);
  assert.equal((await r.api('/api/v1/admin/requests?source=personal_finish_cf_v1','alice')).status,403);
  assert.equal((await r.api('/api/v1/admin/requests/approve-book-finish','admin','POST',{request_id:'daily-unrelated'})).status,400);
  const book=await r.db.prepare("SELECT status,json_extract(dados,'$.finishRequestId') AS request_id FROM livros_pessoais WHERE id='finish-book'").first();
  assert.equal(book.status,'pending_finish');assert.equal(book.request_id,requests.results[0].id);
  const approved=await r.api('/api/v1/admin/requests/approve-book-finish','admin','POST',{request_id:requests.results[0].id,reason:'Aprovado.'});assert.equal(approved.status,200,await approved.clone().text());
  assert.equal((await r.db.prepare("SELECT status,pagina_atual FROM livros_pessoais WHERE id='finish-book'").first()).status,'finished');
  assert.equal((await r.db.prepare("SELECT pontos FROM usuarios WHERE id='alice'").first()).pontos,30);
  const duplicate=await r.api('/api/v1/admin/requests/approve-book-finish','admin','POST',{request_id:requests.results[0].id});assert.equal(duplicate.status,200);
  assert.equal((await r.db.prepare("SELECT pontos FROM usuarios WHERE id='alice'").first()).pontos,30);
});
test('private R2 assets link only to the owner book and cannot be deleted while referenced',async()=>{
  await r.api('/api/v1/library/books','alice','POST',{id:'asset-book',titulo:'Arquivo seguro',autor:'A. Pessoa',paginas:90});
  const form=new FormData();form.append('file',new File(['PK\u0003\u0004epub'],'secure.epub',{type:'application/epub+zip'}));form.append('tipo','epub');
  const upload=await r.api('/api/v1/files/upload','alice','POST',form);assert.equal(upload.status,201,await upload.clone().text());const asset=(await upload.json()).file;
  assert.equal((await r.api('/api/v1/library/books/asset-book/assets','alice','POST',{file_id:asset.id,role:'epub'})).status,201);
  assert.equal((await r.api('/api/v1/library/books/asset-book/assets','bob','POST',{file_id:asset.id,role:'epub'})).status,404);
  assert.equal((await r.api('/api/v1/files/'+asset.id,'alice','DELETE')).status,409);
  const file=await r.api('/api/v1/files/'+asset.id);assert.equal(file.status,200);assert.equal(await file.text(),'PK\u0003\u0004epub');
  assert.equal((await r.api('/api/v1/library/books/asset-book','alice','DELETE')).status,200);
  assert.equal((await r.api('/api/v1/files/'+asset.id,'alice','DELETE')).status,200);
});
test('private shelves are protected and stale device copies do not regress progress',async()=>{
  const before=(await (await r.api('/api/v1/library/books/book-stable')).json()).book;
  await r.api('/api/v1/library/books/book-stable','alice','PUT',{pagina_atual:2,epub_cfi:'stale',atualizado_em:'2000-01-01T00:00:00Z'});
  assert.equal((await (await r.api('/api/v1/library/books/book-stable')).json()).book.pagina_atual,before.pagina_atual);
  assert.equal((await r.api('/api/v1/library/books/book-stable?member_id=alice','bob')).status,200);
  await r.api('/api/v1/me','alice','PATCH',{biblioteca_publica:false});
  assert.equal((await r.api('/api/v1/library/books/book-stable?member_id=alice','bob')).status,404);
  assert.equal((await r.api('/api/v1/library/books/book-stable','alice','DELETE')).status,200);
  assert.ok(await r.db.prepare('SELECT id FROM livros_pessoais WHERE id=?').bind('book-stable').first());
});
