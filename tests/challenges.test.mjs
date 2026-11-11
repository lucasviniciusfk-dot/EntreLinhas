import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './runtime.mjs';
let r;
before(async()=>r=await runtime());after(async()=>await r?.close());

test('challenge definitions are per-account for progress and inactive definitions stay admin-only',async()=>{
  const base={titulo:'Desafio ativo',descricao:'Leia',tipo:'pages',meta:40,meta_texto:'',xp:10,pontos:5,prazo:null,ativo:1,dados:'{}',criado_em:'2026-11-01T00:00:00Z',atualizado_em:'2026-11-01T00:00:00Z'};
  await r.insert('desafios',{...base,id:'challenge-active'});
  await r.insert('desafios',{...base,id:'challenge-hidden',titulo:'Removido',ativo:0});
  await r.insert('usuario_desafios',{id:'alice-progress',usuario_id:'alice',desafio_id:'challenge-active',progresso:12,concluido:0,status:'active',dados:'{}',criado_em:'2026-11-01T00:00:00Z',atualizado_em:'2026-11-02T00:00:00Z'});
  await r.insert('usuario_desafios',{id:'bob-progress',usuario_id:'bob',desafio_id:'challenge-active',progresso:30,concluido:0,status:'active',dados:'{}',criado_em:'2026-11-01T00:00:00Z',atualizado_em:'2026-11-03T00:00:00Z'});
  const member=await (await r.api('/api/v1/challenges','alice')).json();
  assert.deepEqual(member.items.map(x=>x.id),['challenge-active']);
  assert.deepEqual(member.progress.map(x=>x.id),['alice-progress']);
  assert.equal(member.progress[0].concluido,false);
  const definitions=await (await r.api('/api/v1/challenges?definitions_only=1','alice')).json();
  assert.deepEqual(definitions.items.map(x=>x.id),['challenge-active']);assert.deepEqual(definitions.progress,[]);
  const admin=await (await r.api('/api/v1/challenges','admin')).json();
  assert.deepEqual(new Set(admin.items.map(x=>x.id)),new Set(['challenge-active','challenge-hidden']));
  assert.deepEqual(admin.progress.map(x=>x.id),[]);
});

test('only admins create, edit and soft-delete validated challenge definitions',async()=>{
  const payload={title:'Ler fantasia',description:'Terminar livros de fantasia.',type:'genre',metaText:'fantasia',target:2,xp:25,points:8,deadline:'2026-12-01',active:true};
  assert.equal((await r.api('/api/v1/challenges','alice','POST',payload)).status,403);
  const createdResponse=await r.api('/api/v1/challenges','admin','POST',payload),created=await createdResponse.json();
  assert.equal(createdResponse.status,201);assert.equal(created.item.titulo,payload.title);assert.equal(created.item.meta,2);assert.equal(created.item.ativo,true);assert.equal(created.item.criado_por,'admin');
  const id=created.item.id;
  const changed=await (await r.api('/api/v1/challenges/'+id,'admin','PUT',{title:'Fantasia revisado',target:3,active:false})).json();
  assert.equal(changed.item.id,id);assert.equal(changed.item.titulo,'Fantasia revisado');assert.equal(changed.item.meta,3);assert.equal(changed.item.tipo,'genre');assert.equal(changed.item.ativo,false);
  assert.equal((await r.api('/api/v1/challenges/'+id,'alice','DELETE')).status,403);
  const removed=await (await r.api('/api/v1/challenges/'+id,'admin','DELETE')).json();
  assert.equal(removed.active,false);assert.equal((await r.db.prepare('SELECT ativo FROM desafios WHERE id=?').bind(id).first()).ativo,0);
  assert.equal((await r.api('/api/v1/challenges','admin','POST',{...payload,type:'unknown'})).status,400);
});
