import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './runtime.mjs';
let r;
before(async()=>r=await runtime());after(async()=>await r?.close());
test('weekly rewards use server configuration and verified progress',async()=>{
  await r.insert('app_configuracoes',{usuario_id:'global',id:'weekly',chave:'meta_semanal',valor:JSON.stringify({target:100,type:'paginas',rewardXp:100,rewardPoints:50,active:true})});
  const forged=await (await r.api('/api/v1/rewards/period','alice','POST',{kind:'weekly',period_key:'2026-11-09',current:999999,target:1,xp:999999,points:999999})).json();
  assert.equal(forged.applied,false);assert.equal(forged.reason,'target_not_reached');
  await r.insert('metas_diarias',{id:'weekly-progress',usuario_id:'alice',data:'2026-11-10',paginas_lidas:100,meta_paginas:20,origem:'reader',concluida:1,recompensada:0,livros:'[]'});
  const results=await Promise.all(Array.from({length:8},()=>r.api('/api/v1/rewards/period','alice','POST',{kind:'weekly',period_key:'2026-11-09',current:999999,target:1,xp:999999,points:999999})));
  for(const response of results){assert.equal(response.status,200);assert.equal((await response.json()).ok,true);}
  const u=await r.db.prepare('SELECT xp,pontos FROM usuarios WHERE id=?').bind('alice').first();
  assert.equal(u.xp,170);assert.equal(u.pontos,70);
  assert.equal((await r.db.prepare('SELECT count(*) AS n FROM entrel_reward_claims_v510 WHERE usuario_id=?').bind('alice').first()).n,1);
});
test('daily reward pays only once under concurrent requests',async()=>{
  await r.insert('metas_diarias',{id:'daily-progress',usuario_id:'bob',data:'2026-11-11',paginas_lidas:20,meta_paginas:20,origem:'reader',concluida:1,recompensada:0,livros:'[]'});
  const results=await Promise.all(Array.from({length:10},()=>r.api('/api/v1/rewards/daily-epub','bob','POST',{date:'2026-11-11'})));
  for(const response of results)assert.equal(response.status,200);
  const u=await r.db.prepare('SELECT xp,pontos FROM usuarios WHERE id=?').bind('bob').first();
  assert.equal(u.xp,90);assert.equal(u.pontos,30);
});
test('ordinary accounts cannot execute administrative reward operations',async()=>{
  for(const path of ['/api/v1/admin/requests/apply-reward','/api/v1/admin/requests/approve-club-finish','/api/v1/admin/requests/approve-book-finish','/api/v1/admin/club/finish-participant']){
    assert.equal((await r.api(path,'alice','POST',{request_id:'anything',user_id:'bob',xp:999999})).status,403);
  }
});
