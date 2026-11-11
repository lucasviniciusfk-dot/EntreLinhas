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

test('challenge requests keep proofs private, enforce ownership, and award exactly once on approval',async()=>{
  const challengeId='challenge-request-cloudflare',base={titulo:'Desafio com comprovante',descricao:'Leia e envie uma resenha.',tipo:'manual',meta:10,meta_texto:'',xp:30,pontos:12,prazo:null,ativo:1,dados:JSON.stringify({proofRequirement:'text_image'}),criado_por:'admin',criado_em:'2026-11-04T00:00:00Z',atualizado_em:'2026-11-04T00:00:00Z'};
  await r.insert('desafios',{...base,id:challengeId});
  await r.files.put('alice/receipt/challenge-proof',new Uint8Array([1,2,3]),{httpMetadata:{contentType:'image/png'}});
  await r.insert('file_assets',{id:'challenge-proof',owner_id:'alice',object_key:'alice/receipt/challenge-proof',category:'receipt',original_name:'proof.png',content_type:'image/png',size_bytes:3,created_at:'2026-11-04T00:00:00Z'});
  assert.equal((await r.api('/api/v1/challenges/'+challengeId+'/requests','alice','POST',{request_id:'challenge-proof-missing-note',proof_file_id:'challenge-proof'})).status,400);
  assert.equal((await r.api('/api/v1/challenges/'+challengeId+'/requests','bob','POST',{request_id:'challenge-proof-not-owned',note:'Li o livro.',proof_file_id:'challenge-proof'})).status,403);
  const submitted=await r.api('/api/v1/challenges/'+challengeId+'/requests','alice','POST',{request_id:'challenge-proof-request',note:'Li o livro e concluí a atividade.',reference:'Duna',progress:8,proof_file_id:'challenge-proof'});
  assert.equal(submitted.status,201);const created=(await submitted.json()).request;
  assert.equal(created.origem,'challenge_cf_v1');assert.equal(created.comprovante,'cf-asset:challenge-proof');assert.equal(created.desafio_id,challengeId);
  const duplicate=await r.api('/api/v1/challenges/'+challengeId+'/requests','alice','POST',{request_id:'challenge-proof-second-id',note:'Outra tentativa.'});
  assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).already_pending,true);
  assert.equal((await r.api('/api/v1/admin/challenge-requests','alice')).status,403);
  const queue=await (await r.api('/api/v1/admin/challenge-requests?status=pending','admin')).json();assert.equal(queue.count,1);assert.equal(queue.items[0].id,'challenge-proof-request');
  assert.equal((await r.api('/api/v1/files/challenge-proof','bob')).status,404);
  assert.equal((await r.api('/api/v1/files/challenge-proof','admin')).status,200);
  assert.equal((await r.api('/api/v1/files/challenge-proof','alice','DELETE')).status,409);
  const before=await r.db.prepare("SELECT xp,pontos FROM usuarios WHERE id='alice'").first();
  const [firstReview,repeatReview]=await Promise.all([
    r.api('/api/v1/admin/challenge-requests/challenge-proof-request/review','admin','POST',{action:'approved'}),
    r.api('/api/v1/admin/challenge-requests/challenge-proof-request/review','admin','POST',{action:'approved'})
  ]);
  assert.equal(firstReview.status,200);assert.equal(repeatReview.status,200);
  const reviews=[await firstReview.json(),await repeatReview.json()];assert.equal(reviews.some(row=>row.already_reviewed),true);
  const after=await r.db.prepare("SELECT xp,pontos FROM usuarios WHERE id='alice'").first();assert.equal(after.xp,before.xp+30);assert.equal(after.pontos,before.pontos+12);
  const progress=await r.db.prepare('SELECT progresso,concluido,status,dados FROM usuario_desafios WHERE usuario_id=? AND desafio_id=?').bind('alice',challengeId).first();
  assert.equal(progress.concluido,1);assert.equal(progress.status,'concluido');assert.equal(JSON.parse(progress.dados).recompensa_aplicada,true);
  const request=await r.db.prepare('SELECT status FROM solicitacoes_validacao WHERE id=?').bind('challenge-proof-request').first();assert.equal(request.status,'approved');
  assert.equal((await r.db.prepare("SELECT count(*) AS n FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=1").bind('challenge:alice:'+challengeId).first()).n,1);
  assert.equal((await r.db.prepare("SELECT count(*) AS n FROM app_notificacoes WHERE usuario_id='alice' AND origem='challenge_cf_v1'").first()).n,1);
});

test('challenge rejection and previously rewarded challenges never grant another reward',async()=>{
  const makeChallenge=id=>({id,titulo:id,descricao:'Leitura validada',tipo:'manual',meta:1,meta_texto:'',xp:25,pontos:7,prazo:null,ativo:1,dados:'{}',criado_por:'admin',criado_em:'2026-11-05T00:00:00Z',atualizado_em:'2026-11-05T00:00:00Z'});
  await r.insert('desafios',makeChallenge('challenge-rejected-cloudflare'));
  await r.insert('desafios',makeChallenge('challenge-already-rewarded'));
  await r.insert('desafios',makeChallenge('challenge-completed-unrewarded'));
  await r.insert('usuario_desafios',{id:'challenge-already-progress',usuario_id:'alice',desafio_id:'challenge-already-rewarded',progresso:1,concluido:1,concluido_em:'2026-11-04T00:00:00Z',status:'concluido',dados:'{"recompensa_aplicada":true}',criado_em:'2026-11-04T00:00:00Z',atualizado_em:'2026-11-04T00:00:00Z'});
  await r.insert('usuario_desafios',{id:'challenge-unrewarded-progress',usuario_id:'alice',desafio_id:'challenge-completed-unrewarded',progresso:1,concluido:1,concluido_em:'2026-11-04T00:00:00Z',status:'concluido',dados:'{"recompensa_aplicada":false}',criado_em:'2026-11-04T00:00:00Z',atualizado_em:'2026-11-04T00:00:00Z'});
  for(const [challengeId,requestId] of [['challenge-rejected-cloudflare','challenge-rejected-request'],['challenge-already-rewarded','challenge-no-double-reward'],['challenge-completed-unrewarded','challenge-repair-unpaid-reward']]){
    const submitted=await r.api('/api/v1/challenges/'+challengeId+'/requests','alice','POST',{request_id:requestId,note:'Concluído.'});assert.equal(submitted.status,201);
  }
  const before=await r.db.prepare("SELECT xp,pontos FROM usuarios WHERE id='alice'").first();
  assert.equal((await r.api('/api/v1/admin/challenge-requests/challenge-rejected-request/review','admin','POST',{action:'rejected',reason:'Falta evidência.'})).status,200);
  const approved=await r.api('/api/v1/admin/challenge-requests/challenge-no-double-reward/review','admin','POST',{action:'approved'});assert.equal(approved.status,200);assert.equal((await approved.json()).applied,false);
  const repaired=await r.api('/api/v1/admin/challenge-requests/challenge-repair-unpaid-reward/review','admin','POST',{action:'approved'});assert.equal(repaired.status,200);assert.equal((await repaired.json()).applied,true);
  const after=await r.db.prepare("SELECT xp,pontos FROM usuarios WHERE id='alice'").first();assert.equal(after.xp,before.xp+25);assert.equal(after.pontos,before.pontos+7);
  assert.equal((await r.db.prepare("SELECT count(*) AS n FROM entrel_reward_claims_v510 WHERE claim_key='challenge:alice:challenge-rejected-cloudflare'").first()).n,0);
  assert.equal((await r.db.prepare("SELECT status FROM solicitacoes_validacao WHERE id='challenge-rejected-request'").first()).status,'rejected');
});
