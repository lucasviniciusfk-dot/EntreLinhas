import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './runtime.mjs';
let r;
before(async()=>r=await runtime());after(async()=>await r?.close());
test('book approval updates the actual book and reading without a Postgres UUID default',async()=>{
  await r.insert('livros_pessoais',{id:'book',usuario_id:'alice',livro_id:'linked-book',titulo:'Livro',autor:'Autor',paginas:100,ativo:1,dados:'{}'});
  await r.insert('solicitacoes_validacao',{id:'book-request',usuario_id:'alice',tipo:'finish',status:'pending',livro_id:'book',xp:0,pontos:10,dados:'{}'});
  const result=await r.api('/api/v1/admin/requests/approve-book-finish','admin','POST',{request_id:'book-request'});
  assert.equal(result.status,200,await result.clone().text());
  assert.equal((await r.db.prepare('SELECT status FROM livros_pessoais WHERE id=?').bind('book').first()).status,'finished');
  const reading=await r.db.prepare('SELECT * FROM leituras WHERE usuario_id=?').bind('alice').first();assert.ok(reading.id);assert.equal(reading.pagina_atual,100);
  await r.api('/api/v1/admin/requests/approve-book-finish','admin','POST',{request_id:'book-request'});
  assert.equal((await r.db.prepare('SELECT pontos FROM usuarios WHERE id=?').bind('alice').first()).pontos,30);
});
test('club approval is idempotent and recognizes an imported reward already paid',async()=>{
  await r.insert('clube_livro_atual',{id:'atual',titulo:'Livro do Clube',paginas_total:200,xp_recompensa:25,pontos_recompensa:10,ativo:1,status:'active'});
  for(const [user,paid]of [['alice',0],['bob',1]]){
    await r.insert('clube_livro_participantes',{id:'participant-'+user,livro_id:'atual',usuario_id:user,ciclo_id:'cycle-1',recompensa_recebida:paid});
    await r.insert('solicitacoes_validacao',{id:'club-request-'+user,usuario_id:user,tipo:'finish',status:'pending',xp:25,pontos:10,dados:JSON.stringify({request_kind:'club_finish',cycle_id:'cycle-1',participant_id:'participant-'+user})});
    const results=await Promise.all(Array.from({length:5},()=>r.api('/api/v1/admin/requests/approve-club-finish','admin','POST',{request_id:'club-request-'+user})));
    for(const response of results)assert.equal(response.status,200);
  }
  assert.equal((await r.db.prepare('SELECT xp FROM usuarios WHERE id=?').bind('alice').first()).xp,95);
  assert.equal((await r.db.prepare('SELECT xp FROM usuarios WHERE id=?').bind('bob').first()).xp,70);
});
test('monthly verified progress recognizes JSON booleans from approved club requests',async()=>{
  const month=new Date().toISOString().slice(0,7);
  const response=await r.api('/api/v1/progress/monthly?period='+month,'alice');
  assert.equal(response.status,200);const data=await response.json();assert.ok(data.current>=1,JSON.stringify(data));
});
