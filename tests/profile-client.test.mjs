import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function context() {
  const c={URL,URLSearchParams,Headers,FormData,Blob,File,AbortController,setTimeout,clearTimeout,location:{search:''},fetch:async()=>{throw new Error('No network expected')}};
  c.window=c;c.globalThis=c;vm.createContext(c);
  for(const f of ['entrelinhas-api-client.js','entrelinhas-profile-data.js'])vm.runInContext(readFileSync(new URL('../cloudflare/'+f,import.meta.url),'utf8'),c);
  return c;
}
function auth(){return{getSession:async()=>({data:{session:{user:{id:'alice'},access_token:'private-test-token'}}})}}
test('client uses the verified hostname, bearer auth and multipart headers',async()=>{
  const c=context(),calls=[],api=c.EntreLinhasCloudflareApi.create({client:{auth:auth()},fetch:async(url,init)=>{calls.push({url,init});return Response.json({ok:true,profile:{id:'alice'}})}});
  await api.updateMe({bio:''});await api.uploadFile(new File(['abc'],'photo.png',{type:'image/png'}),'avatar');
  await api.getGlobalSetting('meta_semanal');await api.saveGlobalSetting('meta_semanal',{target:90});await api.saveReading({book_id:'book',current_page:8});await api.awardDailyEpub('2026-11-11');await api.getMonthlyProgress('2026-11');await api.awardPeriod('monthly','2026-11');await api.listChallenges();await api.createChallenge({title:'Desafio'});await api.updateChallenge('ch-1',{title:'Atualizado'});await api.removeChallenge('ch-1');
  assert.equal(calls[0].url,'https://entrelinhas-api-staging.lucasviniciusfk.workers.dev/api/v1/me');
  assert.equal(calls[0].init.headers.get('Authorization'),'Bearer private-test-token');
  assert.equal(calls[1].init.headers.has('Content-Type'),false);
  assert.deepEqual(calls.slice(2).map(x=>x.url.replace('https://entrelinhas-api-staging.lucasviniciusfk.workers.dev','')),[
    '/api/v1/settings/global/meta_semanal','/api/v1/settings/global/meta_semanal','/api/v1/reading','/api/v1/rewards/daily-epub','/api/v1/progress/monthly?period=2026-11','/api/v1/rewards/period','/api/v1/challenges?definitions_only=1','/api/v1/challenges','/api/v1/challenges/ch-1','/api/v1/challenges/ch-1'
  ]);
});
test('Cloudflare profile has one writer and never falls back after an ambiguous write',async()=>{
  const c=context(),calls=[];
  const facade=c.EntreLinhasProfileData.create({enabled:true,client:{auth:auth(),from(){throw new Error('Unexpected Supabase write')}},api:{
    getMe:async()=>({ok:true,profile:{id:'alice',nome:'Antes'}}),
    updateMe:async body=>{calls.push(body);throw Object.assign(new Error('Network failure'),{code:'NETWORK'})}
  }});
  await facade.load('alice');
  await assert.rejects(()=>facade.save('alice',{nome:'Depois',xp:9999,id:'bob'}),/Network failure/);
  assert.equal(facade.provider('alice'),'cloudflare');assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{nome:'Depois'}]);
});
test('fallback is pinned before a write and authentication errors never downgrade',async()=>{
  const c=context();let writes=0;
  const query={select(){return this},eq(){return this},maybeSingle:async()=>({data:{id:'alice',nome:'Legacy'}}),single:async()=>({data:{id:'alice',nome:'Fallback'}})};
  const client={auth:auth(),from:()=>({select:()=>query,update:()=>{writes++;return query}})};
  const f=c.EntreLinhasProfileData.create({enabled:true,client,api:{getMe:async()=>{throw Object.assign(new Error('down'),{status:503})}}});
  await f.load('alice');await f.save('alice',{nome:'Fallback'});assert.equal(writes,1);assert.equal(f.provider('alice'),'supabase');
  const denied=c.EntreLinhasProfileData.create({enabled:true,client,api:{getMe:async()=>{throw Object.assign(new Error('denied'),{status:401})}}});
  await assert.rejects(()=>denied.load('alice'),/denied/);
  await assert.rejects(()=>f.save('bob',{nome:'Intruso'}),/próprio perfil/);
});
test('real frontend normalizer preserves cleared fields, false flags and zero balances',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const line=html.split(/\r?\n/).find(l=>l.startsWith('  function normalizeUser(row,fallback,au){'));
  const c={cleanName:x=>x,frameSlug:x=>x,num:x=>Number(x)||0};vm.createContext(c);vm.runInContext(line,c);
  const p=c.normalizeUser({id:'alice',nome:'Alice',bio:'',livro_favorito:'',foto_url:'',perfil_privado:false,biblioteca_publica:false,xp:0,pontos:0},{bio:'old',favoriteBook:'old',photo:'old',hidden:true,publicShelf:true,xp:90,pontos:20},{});
  assert.equal(p.bio,'');assert.equal(p.favoriteBook,'');assert.equal(p.photo,'');assert.equal(p.hidden,false);assert.equal(p.publicShelf,false);assert.equal(p.xp,0);assert.equal(p.pontos,0);
});
