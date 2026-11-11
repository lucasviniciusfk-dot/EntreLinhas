import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './runtime.mjs';
let r;before(async()=>r=await runtime());after(async()=>await r?.close());

test('achievement reconciliation derives awards from D1 evidence, stays idempotent and never changes rewards',async()=>{
  await r.insert('medalhas',{id:'10000000-0000-4000-8000-000000000100',nome:'Primeira Tinta',categoria:'pages',descricao:'100 páginas',imagem_url:'',criado_em:'2026-11-01T00:00:00Z'});
  await r.insert('usuario_molduras',{id:'existing-frame',usuario_id:'alice',moldura_id:'00000000-0000-0000-0000-000000000001',ativa:null,desbloqueada_em:'2026-11-01T00:00:00Z'});
  const created=await r.api('/api/v1/library/books','alice','POST',{id:'award-book',titulo:'Páginas verdadeiras',autor:'A. Leitor',paginas:100,pagina_atual:100});assert.equal(created.status,201);
  const first=await r.api('/api/v1/me/awards/reconcile','alice','POST',{user_id:'bob',medals:['sec_escolhido'],frames:['lenda_entrelinhas']});assert.equal(first.status,200,await first.clone().text());
  const result=await first.json();assert.ok(result.granted.medals.includes('pg100'));assert.deepEqual(result.granted.medals.filter(x=>x==='sec_escolhido'),[]);assert.equal(result.rewards_changed,false);assert.deepEqual(result.granted.frames,[]);
  assert.ok(result.medals.some(x=>x.medalha_id==='10000000-0000-4000-8000-000000000100'));
  const second=await r.api('/api/v1/me/awards/reconcile','alice','POST',{});assert.equal(second.status,200);assert.deepEqual((await second.json()).granted,{medals:[],frames:[]});
  assert.equal((await r.db.prepare('SELECT count(*) AS n FROM usuario_medalhas WHERE usuario_id=?').bind('alice').first()).n,1);
  assert.equal((await r.db.prepare('SELECT count(*) AS n FROM usuario_molduras WHERE usuario_id=?').bind('alice').first()).n,1);
  assert.equal((await r.db.prepare('SELECT pontos,xp FROM usuarios WHERE id=?').bind('alice').first()).pontos,20);
  assert.equal((await r.db.prepare('SELECT count(*) AS n FROM usuario_medalhas WHERE usuario_id=?').bind('bob').first()).n,0);
});
