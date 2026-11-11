import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './runtime.mjs';
let r;
before(async()=>r=await runtime());after(async()=>await r?.close());
test('global read and hide state are individual and repeatable',async()=>{
  await r.insert('app_notificacoes',{id:'global',usuario_id:'all',target_id:'all',titulo:'Global',lida:0,lida_por:'[]',ocultada_por:'[]',criada_em:'2026-11-11T00:00:00Z'});
  await Promise.all(Array.from({length:6},()=>r.api('/api/v1/notifications/global/read','alice','POST',{})));
  const a=await (await r.api('/api/v1/notifications','alice')).json(),b=await (await r.api('/api/v1/notifications','bob')).json();
  assert.equal(a.items[0].lida,true);assert.equal(b.items[0].lida,false);
  await r.api('/api/v1/notifications/global/hide','alice','POST',{});
  assert.equal((await (await r.api('/api/v1/notifications','alice')).json()).items.length,0);
  assert.equal((await (await r.api('/api/v1/notifications','bob')).json()).items.length,1);
  assert.deepEqual(JSON.parse((await r.db.prepare('SELECT lida_por FROM app_notificacoes WHERE id=?').bind('global').first()).lida_por),['alice']);
});
test('notification pagination has no duplicates for identical timestamps',async()=>{
  for(let i=0;i<6;i++)await r.insert('app_notificacoes',{id:'page-'+i,usuario_id:'alice',target_id:'alice',titulo:'Notice',lida:0,lida_por:'[]',ocultada_por:'[]',criada_em:'2026-11-12T00:00:00Z'});
  const a=await (await r.api('/api/v1/notifications?limit=3')).json();
  const b=await (await r.api('/api/v1/notifications?limit=3&before='+encodeURIComponent(a.nextCursor.before)+'&before_id='+a.nextCursor.before_id)).json();
  assert.equal(a.items.length,3);assert.equal(b.items.length,3);assert.equal(a.items.some(x=>b.items.some(y=>y.id===x.id)),false);
});
