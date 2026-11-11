import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {runtime} from './runtime.mjs';
let rt;
before(async()=>{rt=await runtime()});
after(async()=>{await rt?.close()});
test('health and CORS permit authenticated PUT from the staging preview',async()=>{
  const h=await rt.api('/health','');assert.equal((await h.json()).bindings.d1,true);
  const r=await rt.mf.dispatchFetch('https://local.test/api/v1/me',{method:'OPTIONS',headers:{Origin:'https://deploy-preview-4--entrelinhasoff.netlify.app'}});
  assert.equal(r.status,204);assert.match(r.headers.get('Access-Control-Allow-Methods'),/PUT/);assert.equal(r.headers.get('Access-Control-Allow-Origin'),'https://deploy-preview-4--entrelinhasoff.netlify.app');
});
test('missing/invalid auth and upstream failure do not grant access',async()=>{
  assert.equal((await rt.api('/api/v1/me','')).status,401);
  assert.equal((await rt.api('/api/v1/me','forged')).status,401);
  assert.equal((await rt.api('/api/v1/me','unavailable')).status,503);
});
test('PATCH persists only supplied fields for the authenticated identity',async()=>{
  const r=await rt.api('/api/v1/me','alice','PATCH',{nome:'Alice Nova',bio:'',biblioteca_publica:false,perfil_privado:false});
  assert.equal(r.status,200);const p=(await r.json()).profile;
  assert.equal(p.nome,'Alice Nova');assert.equal(p.bio,'');assert.equal(p.biblioteca_publica,false);assert.equal(p.perfil_privado,false);assert.equal(p.xp,70);assert.equal(p.pontos,20);
  assert.equal((await rt.db.prepare('SELECT nome FROM usuarios WHERE id=?').bind('bob').first()).nome,'bob');
  assert.equal((await rt.api('/api/v1/me','alice','PATCH',{id:'bob',nome:'Intruso'})).status,400);
  assert.equal((await rt.api('/api/v1/me','alice','PATCH',{is_admin:true})).status,400);
});
test('profile text, privacy, photos and locked frames are validated',async()=>{
  for(const body of [{nome:''},{bio:{}},{perfil_privado:'false'},{foto_url:'javascript:alert(1)'},{foto_url:'blob:temporary'}])assert.equal((await rt.api('/api/v1/me','alice','PATCH',body)).status,400);
  assert.equal((await rt.api('/api/v1/me','alice','PATCH',{moldura_atual:'lenda_entrelinhas'})).status,403);
  assert.equal((await rt.api('/api/v1/me','alice','PATCH',{foto_url:'cf-asset:other-account'})).status,403);
  assert.equal((await rt.api('/api/v1/me','alice','PATCH',{bio:null,livro_favorito:null,moldura_atual:'none'})).status,200);
});
test('bootstrap preserves IDs and existing fields and never trusts metadata roles',async()=>{
  const old=await rt.db.prepare('SELECT * FROM usuarios WHERE id=?').bind('alice').first();
  assert.equal((await rt.api('/api/v1/me/bootstrap','alice','POST',{})).status,200);
  assert.deepEqual(await rt.db.prepare('SELECT * FROM usuarios WHERE id=?').bind('alice').first(),old);
  assert.equal((await rt.api('/api/v1/me/bootstrap','new','POST',{})).status,200);
  const fresh=await rt.db.prepare('SELECT * FROM usuarios WHERE id=?').bind('new').first();
  assert.equal(fresh.id,'new');assert.equal(fresh.is_admin,0);assert.equal(fresh.admin_principal,0);
});
test('R2 bytes and D1 metadata round-trip; another user cannot read or delete',async()=>{
  const bytes=new Uint8Array([137,80,78,71,13,10,26,10]), form=new FormData();
  form.append('tipo','avatar');form.append('file',new File([bytes],'test.png',{type:'image/png'}));
  const up=await rt.api('/api/v1/files/upload','alice','POST',form);assert.equal(up.status,201);const file=(await up.json()).file;
  assert.equal((await rt.api('/api/v1/files/'+file.id,'bob')).status,404);
  assert.equal((await rt.api('/api/v1/files/'+file.id,'bob','DELETE')).status,404);
  const down=await rt.api('/api/v1/files/'+file.id);assert.deepEqual(new Uint8Array(await down.arrayBuffer()),bytes);
  assert.equal((await rt.api('/api/v1/me','alice','PATCH',{foto_url:'cf-asset:'+file.id})).status,200);
  assert.equal((await rt.api('/api/v1/files/'+file.id,'alice','DELETE')).status,200);
  assert.equal((await rt.api('/api/v1/files/'+file.id)).status,404);
  const row=await rt.db.prepare('SELECT * FROM file_assets WHERE id=?').bind(file.id).first();assert.ok(row.deleted_at);
  assert.equal(await (await rt.mf.getR2Bucket('FILES')).head(row.object_key),null);
});
test('private album photo returns actual R2 bytes and metadata',async()=>{
  await rt.insert('clube_albuns',{id:'album',nome:'Encontro',ativo:1});
  await rt.insert('file_assets',{id:'photo-asset',owner_id:'admin',object_key:'admin/photo',category:'club-photo',content_type:'image/png',original_name:'foto.png',size_bytes:3,created_at:new Date().toISOString()});
  await (await rt.mf.getR2Bucket('FILES')).put('admin/photo',new Uint8Array([1,2,3]));
  await rt.insert('clube_fotos',{id:'photo',album_id:'album',storage_path:'photo-asset',origem_arquivo:'r2-private-v1',ativo:1,url:'private://photo-asset'});
  const r=await rt.api('/api/v1/club/albums/photos/photo/content');assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'image/png');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),new Uint8Array([1,2,3]));
  assert.equal((await rt.api('/api/v1/club/albums','alice','POST',{name:'Forbidden'})).status,403);
});
test('notification mutations obey the same recipient rule as reads',async()=>{
  await rt.insert('app_notificacoes',{id:'notice',usuario_id:'bob',target_id:'all',titulo:'Private',lida:0,lida_por:'[]',ocultada_por:'[]'});
  assert.equal((await rt.api('/api/v1/notifications/notice/read','alice','POST',{})).status,404);
  assert.equal((await rt.db.prepare('SELECT lida FROM app_notificacoes WHERE id=?').bind('notice').first()).lida,0);
});
