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
test('club albums preserve separate covers and allow owner photo actions only while unlocked',async()=>{
  const created=await r.api('/api/v1/club/albums','admin','POST',{name:'Encontro teste',meeting_date:'2026-11-11',book_title:'Livro',book_author:'Autora',book_cover_url:'https://cdn.test/livro.png',cover_url:'https://cdn.test/album.png'});
  assert.equal(created.status,201,await created.clone().text());const album=(await created.json()).album;
  assert.equal(album.livro_capa_url,'https://cdn.test/livro.png');assert.equal(album.capa_url,'https://cdn.test/album.png');
  const upload=async token=>{const form=new FormData();form.append('file',new Blob(['img'],{type:'image/png'}),'foto.png');form.append('tipo','club-photo');const response=await r.api('/api/v1/files/upload',token,'POST',form);assert.equal(response.status,201,await response.clone().text());return (await response.json()).file.id;};
  const fileId=await upload('alice');
  const foreign=await r.api('/api/v1/club/albums/photos','bob','POST',{album_id:album.id,file_id:fileId});assert.equal(foreign.status,404);
  const pair=await Promise.all(Array.from({length:2},()=>r.api('/api/v1/club/albums/photos','alice','POST',{album_id:album.id,file_id:fileId})));
  const attached=pair.find(response=>response.status===201),duplicate=pair.find(response=>response.status===200);assert.ok(attached);assert.ok(duplicate);const photo=(await attached.json()).photo;assert.equal((await duplicate.json()).already_attached,true);
  const gallery=await r.api('/api/v1/club/albums/photos?album_id='+encodeURIComponent(album.id),'alice');const photos=await gallery.json();assert.equal(photos.items[0].image_url,'/api/v1/club/albums/photos/'+photo.id+'/content');
  const content=await r.api('/api/v1/club/albums/photos/'+encodeURIComponent(photo.id)+'/content','bob');assert.equal(content.status,200);assert.equal(await content.text(),'img');
  const deniedDelete=await r.api('/api/v1/club/albums/photos/'+encodeURIComponent(photo.id),'bob','DELETE');assert.equal(deniedDelete.status,403);
  const bobFile=await upload('bob'),bobAttach=await r.api('/api/v1/club/albums/photos','bob','POST',{album_id:album.id,file_id:bobFile});assert.equal(bobAttach.status,201);
  const bobPhoto=(await bobAttach.json()).photo,bobDelete=await r.api('/api/v1/club/albums/photos/'+encodeURIComponent(bobPhoto.id),'bob','DELETE');assert.equal(bobDelete.status,200);
  assert.equal((await r.db.prepare('SELECT COUNT(*) AS total FROM clube_fotos WHERE album_id=? AND COALESCE(ativo,1)=1').bind(album.id).first()).total,1);
  const locked=await r.api('/api/v1/club/albums/'+encodeURIComponent(album.id),'admin','PATCH',{locked:true});assert.equal(locked.status,200);
  const preserved=await r.db.prepare('SELECT livro_capa_url,capa_url FROM clube_albuns WHERE id=?').bind(album.id).first();assert.equal(preserved.livro_capa_url,'https://cdn.test/livro.png');assert.equal(preserved.capa_url,'https://cdn.test/album.png');
  const lockedFile=await upload('alice');const deniedUpload=await r.api('/api/v1/club/albums/photos','alice','POST',{album_id:album.id,file_id:lockedFile});assert.equal(deniedUpload.status,403);
  const ownerLockedDelete=await r.api('/api/v1/club/albums/photos/'+encodeURIComponent(photo.id),'alice','DELETE');assert.equal(ownerLockedDelete.status,403);
  const adminDelete=await r.api('/api/v1/club/albums/photos/'+encodeURIComponent(photo.id),'admin','DELETE');assert.equal(adminDelete.status,200);assert.equal((await r.db.prepare('SELECT ativo FROM clube_fotos WHERE id=?').bind(photo.id).first()).ativo,0);
  const removeFile=await r.api('/api/v1/files/'+encodeURIComponent(fileId),'alice','DELETE');assert.equal(removeFile.status,200,await removeFile.clone().text());
});

test('club mural keeps administration writes scoped and member reactions idempotent',async()=>{
  const denied=await r.api('/api/v1/club/mural','alice','POST',{title:'Tentativa',text:'Não publicar'});assert.equal(denied.status,403);
  const created=await r.api('/api/v1/club/mural','admin','POST',{title:'Encontro',text:'Sábado às 15h',type:'evento',pinned:true});
  assert.equal(created.status,201,await created.clone().text());const post=(await created.json()).post;assert.equal(post.autor_id,'admin');assert.equal(post.fixado,1);
  const attempts=await Promise.all(Array.from({length:2},()=>r.api('/api/v1/club/mural/'+encodeURIComponent(post.id)+'/reaction','alice','PUT')));
  for(const response of attempts)assert.equal(response.status,200,await response.clone().text());
  const results=await Promise.all(attempts.map(x=>x.json()));assert.equal(results.filter(x=>x.added).length,1);
  assert.equal((await r.db.prepare('SELECT COUNT(*) AS total FROM clube_mural_reacoes WHERE post_id=? AND usuario_id=?').bind(post.id,'alice').first()).total,1);
  const memberFeed=await r.api('/api/v1/club/mural','bob');assert.equal(memberFeed.status,200);const feed=await memberFeed.json();assert.equal(feed.posts.length,1);assert.equal(feed.reactions.length,1);
  const deniedEdit=await r.api('/api/v1/club/mural/'+encodeURIComponent(post.id),'alice','PATCH',{pinned:false});assert.equal(deniedEdit.status,403);
  const edited=await r.api('/api/v1/club/mural/'+encodeURIComponent(post.id),'admin','PATCH',{pinned:false,text:'Novo horário'});assert.equal(edited.status,200);assert.equal((await edited.json()).post.texto,'Novo horário');
  const deniedDelete=await r.api('/api/v1/club/mural/'+encodeURIComponent(post.id),'alice','DELETE');assert.equal(deniedDelete.status,403);
  const removedReaction=await r.api('/api/v1/club/mural/'+encodeURIComponent(post.id)+'/reaction','alice','DELETE');assert.equal((await removedReaction.json()).removed,1);
  const removed=await r.api('/api/v1/club/mural/'+encodeURIComponent(post.id),'admin','DELETE');assert.equal(removed.status,200);
  assert.equal((await r.db.prepare('SELECT ativo FROM clube_mural WHERE id=?').bind(post.id).first()).ativo,0);
  assert.equal((await r.api('/api/v1/club/mural','bob')).status,200);assert.equal((await (await r.api('/api/v1/club/mural','bob')).json()).posts.length,0);
});
