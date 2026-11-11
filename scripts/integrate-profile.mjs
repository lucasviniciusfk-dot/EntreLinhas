import {readFileSync,writeFileSync} from 'node:fs';
const path = new URL('../index.html', import.meta.url);
const original = readFileSync(path,'utf8'), newline = original.includes('\r\n') ? '\r\n' : '\n';
let html = original.replace(/\r\n/g,'\n');
if (html.includes('/* CF_PROFILE_INTEGRATION_V1 */')) { console.log('Profile integration already applied.'); process.exit(0); }
function replaceOnce(old, next) {
  if (html.split(old).length !== 2) throw new Error('Expected exactly one frontend anchor: '+old.slice(0,100));
  html = html.replace(old,next);
}
const sdk = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>';
replaceOnce(sdk,sdk+'\n  <script src="./cloudflare/entrelinhas-api-client.js"></script>\n  <script src="./cloudflare/entrelinhas-profile-data.js"></script>');
replaceOnce('async function ensureProfile(user){','async function ensureProfile(user){\n    if(window.entrelProfileData && window.entrelProfileData.enabled) return window.entrelProfileData.load(user.id,true);');
const start = html.indexOf('window.saveProfileV166=window.saveProfileV165=window.saveProfileV59=async function(){');
const end = html.indexOf('\n  function profileHTML',start);
if (start < 0 || end < start) throw new Error('Real profile function boundary missing.');
html = html.slice(0,start)+`window.saveProfileV166=window.saveProfileV165=window.saveProfileV59=async function(){
    if(window.__entrelProfileSaving)return;
    window.__entrelProfileSaving=true;
    try {
      const id=await currentAuthId(),cur=(CACHE[id]&&CACHE[id].user)||localUser()||{};
      const patch={nome:cleanName(document.getElementById('profileNameV166').value,cur.name||'Membro'),bio:document.getElementById('profileBioV166').value||'',livro_favorito:document.getElementById('profileFavV166').value||'',perfil_privado:!!document.getElementById('profilePrivateV166').checked,biblioteca_publica:!!document.getElementById('profilePublicShelfV166').checked,moldura_atual:frameSlug(selectedFrame)};
      const row=await window.entrelProfileData.save(id,patch,photoFile);
      CACHE[id]=null;
      data.user=Object.assign({},data.user||{},normalizeUser(row,cur,await sessionUser()));
      saveSafe(); closeModal();
      await loadProfile(id,true); renderSafe();
      info('Perfil salvo','Seu perfil foi atualizado online.');
    }catch(e){info('Erro ao salvar perfil',(e&&e.message)||String(e));}
    finally{window.__entrelProfileSaving=false;}
  };`+html.slice(end);
replaceOnce("else {const r=await c.from('usuarios').select('*').eq('id',userId).maybeSingle(); if(!r.error&&r.data)onlineUser=r.data;}",
  "else if(isOwn&&window.entrelProfileData&&window.entrelProfileData.enabled){onlineUser=await window.entrelProfileData.load(userId,true);} else {const r=await c.from('usuarios').select('*').eq('id',userId).maybeSingle(); if(!r.error&&r.data)onlineUser=r.data;}");
replaceOnce('if(isOwn && (!onlineUser||!onlineUser.nome||looksEmail(onlineUser.nome)))','if(isOwn && !(window.entrelProfileData&&window.entrelProfileData.enabled) && (!onlineUser||!onlineUser.nome||looksEmail(onlineUser.nome)))');
// Preserve intentional empty strings, false privacy/visibility and zero counters.
const ns = html.indexOf('  function normalizeUser(row,fallback,au){');
const ne = html.indexOf('\n',ns);
if(ns<0)throw new Error('Profile normalizer missing.');
let norm=html.slice(ns,ne);
for(const [a,b] of [
 ["row.bio||fallback.bio||''","row.bio??fallback.bio??''"],
 ["row.livro_favorito||fallback.favoriteBook||''","row.livro_favorito??fallback.favoriteBook??''"],
 ["row.foto_url||row.avatar_url||fallback.photo||fallback.avatar||''","row.foto_url??row.avatar_url??fallback.photo??fallback.avatar??''"],
 ["row.foto_url||row.avatar_url||fallback.avatar||fallback.photo||''","row.foto_url??row.avatar_url??fallback.avatar??fallback.photo??''"],
 ["!!(row.perfil_privado||fallback.hidden)","(row.perfil_privado==null?!!fallback.hidden:!!row.perfil_privado)"],
 ["row.biblioteca_publica!==false&&fallback.publicShelf!==false","(row.biblioteca_publica==null?fallback.publicShelf!==false:!!row.biblioteca_publica)"],
 ["row.xp||fallback.xp||fallback.points","row.xp??fallback.xp??fallback.points"],
 ["row.pontos||fallback.pontos||fallback.rankingPoints","row.pontos??fallback.pontos??fallback.rankingPoints"]
]) {if(!norm.includes(a))throw new Error('Normalizer anchor missing: '+a);norm=norm.replace(a,b);}
html=html.slice(0,ns)+norm+html.slice(ne);
// The older achievements refresh must not reintroduce a stale Supabase frame/profile.
replaceOnce('if(c&&userId){\n      try{const rm=',"if(c&&userId&&!(isOwn&&window.entrelProfileData&&window.entrelProfileData.enabled&&window.entrelProfileData.provider(userId)==='cloudflare')){\n      try{const rm=");
html += '\n<!-- /* CF_PROFILE_INTEGRATION_V1 */ -->\n';
writeFileSync(path,html.replace(/\n/g,newline));
console.log('Integrated real profile loader, login bootstrap and save function.');
