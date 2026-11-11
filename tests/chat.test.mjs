import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './runtime.mjs';
let r;
before(async()=>{r=await runtime()});after(async()=>await r?.close());
test('chat sends persist once even when the request is replayed concurrently',async()=>{
  const results=await Promise.all(Array.from({length:8},()=>r.api('/api/v1/chat/messages','alice','POST',{client_id:'stable-id',message:'Olá'})));
  for(const response of results)assert.ok([200,201].includes(response.status),await response.text());
  assert.equal((await r.db.prepare('SELECT count(*) AS n FROM chat_mensagens WHERE id=?').bind('stable-id').first()).n,1);
  assert.equal((await r.api('/api/v1/chat/messages','bob','POST',{client_id:'stable-id',message:'Olá'})).status,409);
});
test('replies take recipient and quoted content from D1 and create one notification',async()=>{
  const result=await r.api('/api/v1/chat/messages','bob','POST',{client_id:'reply-id',message:'Resposta',reply:{id:'stable-id',userId:'admin',text:'Forged'}});
  assert.equal(result.status,201);
  const msg=(await result.json()).message;assert.equal(msg.dados.reply.userId,'alice');assert.equal(msg.dados.reply.text,'Olá');
  await r.api('/api/v1/chat/messages','bob','POST',{client_id:'reply-id',message:'Resposta',reply:{id:'stable-id'}});
  const notes=(await r.db.prepare('SELECT * FROM app_notificacoes').all()).results;
  assert.equal(notes.length,1);assert.equal(notes[0].usuario_id,'alice');
});
test('only the author edits and only admins pin; removal keeps message and reactions',async()=>{
  assert.equal((await r.api('/api/v1/chat/messages/stable-id','bob','PATCH',{message:'Intruso'})).status,403);
  assert.equal((await r.api('/api/v1/chat/messages/stable-id','alice','PATCH',{message:'Olá, editado'})).status,200);
  assert.equal((await r.api('/api/v1/chat/messages/stable-id/pin','alice','PATCH',{pinned:true})).status,403);
  assert.equal((await r.api('/api/v1/chat/messages/stable-id/pin','admin','PATCH',{pinned:true})).status,200);
  assert.equal((await r.api('/api/v1/chat/messages/stable-id/reaction','bob','PUT',{emoji:'❤️'})).status,200);
  assert.equal((await r.api('/api/v1/chat/messages/stable-id','bob','DELETE')).status,403);
  assert.equal((await r.api('/api/v1/chat/messages/stable-id','alice','DELETE')).status,200);
  assert.equal((await r.db.prepare('SELECT removida FROM chat_mensagens WHERE id=?').bind('stable-id').first()).removida,1);
  assert.equal((await r.db.prepare('SELECT count(*) AS n FROM chat_reacoes WHERE mensagem_id=?').bind('stable-id').first()).n,1);
});
test('chat reads paginate with stable keys and reaction batches stay within D1 limits',async()=>{
  const batch=[];
  for(let i=0;i<140;i++)batch.push(r.db.prepare("INSERT INTO chat_mensagens(id,usuario_id,mensagem,fixada,criado_em,editada,apagada,atualizado_em,reacoes,reagido_por,curtidas,removida,dados) VALUES (?,?,'Hi',0,?,0,0,?,'{}','[]','[]',0,'{}')").bind('page-'+String(i).padStart(3,'0'),'alice','2026-11-11T00:00:00Z','2026-11-11T00:00:00Z'));
  await r.db.batch(batch);
  const first=await r.api('/api/v1/chat/messages?limit=100'),data=await first.json();assert.equal(first.status,200);assert.equal(data.items.length,100);assert.equal(data.hasMore,true);
  const next=await (await r.api('/api/v1/chat/messages?limit=100&before='+encodeURIComponent(data.nextCursor.before)+'&before_id='+encodeURIComponent(data.nextCursor.before_id))).json();
  assert.equal(data.items.some(a=>next.items.some(b=>a.id===b.id)),false);
});
