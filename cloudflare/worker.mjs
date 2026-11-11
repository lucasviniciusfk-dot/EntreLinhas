import {handleSettings} from "./domains/settings.mjs";
import {handleLibrary} from "./domains/library.mjs";
import {handleAchievements} from "./domains/achievements.mjs";
import {handleSnapshot} from "./domains/snapshots.mjs";
import {handleChat} from "./domains/chat.mjs";
import {handleChallenges} from "./domains/challenges.mjs";
/* Snapshot revisado do Worker entrelinhas-api-staging.
 * Patch: erros de consulta D1 durante a resolução do perfil retornam 503 controlado.
 * Deploy deve preservar os bindings e settings atuais.
 */
import {handleProfile,bootstrapProfile} from "./domains/profile.mjs";
const cors = (origin) => {
  const allowed = new Set(["https://lucasviniciusfk-dot.github.io","http://localhost:3000","http://localhost:5173","http://localhost:8787","https://entrelinhasoff.netlify.app","https://deploy-preview-4--entrelinhasoff.netlify.app"]);
  const headers = new Headers({"Vary":"Origin","Access-Control-Allow-Methods":"GET, POST, PUT, PATCH, DELETE, OPTIONS","Access-Control-Allow-Headers":"Authorization, Content-Type, If-Match","Access-Control-Max-Age":"86400"});
  if (allowed.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
};
const json=(data,status,headers)=>Response.json(data,{status:status||200,headers});
const clampInt=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.floor(n))):fallback;};
const clean=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const parseObject=value=>{if(value&&typeof value==="object"&&!Array.isArray(value))return value;try{const p=JSON.parse(value||"{}");return p&&typeof p==="object"&&!Array.isArray(p)?p:{};}catch(_){return {};}};
async function authenticate(request,env){const a=request.headers.get("Authorization")||"";if(!a.startsWith("Bearer "))return{error:"missing"};const token=a.slice(7).trim();if(!token)return{error:"missing"};const r=await fetch(env.SUPABASE_URL+"/auth/v1/user",{method:"GET",headers:{"apikey":env.SUPABASE_PUBLISHABLE_KEY,"Authorization":"Bearer "+token}});if(r.status===401||r.status===403)return{error:"invalid"};if(!r.ok)return{error:"upstream"};const u=await r.json();if(!u||typeof u.id!=="string")return{error:"invalid"};return{user:u};}
async function requireUser(request,env,headers){let a;try{a=await authenticate(request,env);}catch(_){return{response:json({ok:false,error:"Serviço de autenticação indisponível."},503,headers)};}if(a.error==="missing")return{response:json({ok:false,error:"Autenticação necessária."},401,headers)};if(a.error==="invalid")return{response:json({ok:false,error:"Sessão inválida ou expirada."},401,headers)};if(a.error)return{response:json({ok:false,error:"Não foi possível validar a sessão."},503,headers)};let p;try{p=await env.DB.prepare("SELECT id,email,estado,banido,banned,apagado,conta_removida,is_admin,admin_principal FROM usuarios WHERE id=? LIMIT 1").bind(a.user.id).first();}catch(_){return{response:json({ok:false,error:"Banco de dados temporariamente indisponível."},503,headers)};}if(!p)return{response:json({ok:false,error:"Perfil não encontrado no banco de staging."},404,headers)};if(p.banido===1||p.banned===1||p.apagado===1||p.conta_removida===1||p.estado==="banido"||p.estado==="removido")return{response:json({ok:false,error:"Esta conta não tem acesso ao aplicativo."},403,headers)};return{user:a.user,profile:p};}
async function readBody(request){const raw=await request.text();if(raw.length>32768)throw new Error("Corpo da requisição muito grande.");const d=JSON.parse(raw||"{}");if(!d||typeof d!=="object"||Array.isArray(d))throw new Error("Formato JSON inválido.");return d;}
function validText(value,max,label,required=false){const s=String(value??"").trim();if(required&&!s)throw new Error(label+" é obrigatório.");if(s.length>max)throw new Error(label+" excede o limite permitido.");return s;}
export default {async fetch(request,env){
 const headers=cors(request.headers.get("Origin")||"");if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 headers.set("Cache-Control","private, no-store");
 const url=new URL(request.url);if(url.pathname==="/health"&&request.method==="GET"){let d1=false;try{const x=await env.DB.prepare("SELECT 1 AS ok").first();d1=!!x&&x.ok===1;}catch(_){}const authReady=!!env.SUPABASE_URL&&!!env.SUPABASE_PUBLISHABLE_KEY;return json({ok:d1&&!!env.FILES&&authReady,environment:"staging",service:"entrelinhas-api-staging",bindings:{d1,r2:!!env.FILES,authConfig:authReady},readRoutesEnabled:true,writeRoutesEnabled:true},200,headers);}
 if(url.pathname==="/__staging-file-check"&&request.method==="GET"){
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entre Linhas — teste de arquivos</title><style>body{font:16px system-ui;background:#111;color:#eee;max-width:560px;margin:32px auto;padding:20px}main{background:#1d1d1d;padding:22px;border-radius:16px}button{box-sizing:border-box;width:100%;padding:14px;border-radius:8px;border:1px solid #555;font:inherit;margin-top:16px;background:#e8e8e8;color:#111;font-weight:700}button:disabled{opacity:.5}#out{white-space:pre-wrap;overflow-wrap:anywhere;background:#090909;padding:12px;border-radius:8px;margin-top:16px}.note{color:#bbb;font-size:14px}</style><main><h2>Teste privado de arquivos — staging</h2><p>Entre com a mesma conta Google usada no Entre Linhas. Não é necessário informar senha.</p><p class="note">A autenticação acontece pelo Supabase Auth com OAuth/PKCE. O token é usado somente neste teste, no navegador, e a sessão temporária é limpa ao terminar. Nenhum arquivo pessoal será enviado: será usado um PNG sintético.</p><button id="go">Continuar com Google e testar</button><pre id="out">Preparando autenticação…</pre></main><script type="module">\nimport { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL="https://jxzcuqwlnqxnhftffbjx.supabase.co";
const SUPABASE_KEY="sb_publishable_LyHzFw6vbzqAPXlLPPPFYA_pQMNyqQc";
const API=location.origin;
const STORAGE_KEY="entrelinhas-staging-oauth-test";
const out=document.getElementById("out"),btn=document.getElementById("go");
const supabase=createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{flowType:"pkce",persistSession:true,autoRefreshToken:false,detectSessionInUrl:true,storage:window.sessionStorage,storageKey:STORAGE_KEY}});
function log(s){out.textContent+="\n"+s;}
async function runTest(token){
 let fileId=null,deleted=false;
 try{
  out.textContent="Sessão Google validada. Iniciando teste de staging…";
  const bytes=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,6,0,0,0,31,21,196,137,0,0,0,13,73,68,65,84,120,156,99,248,207,192,240,31,0,5,0,1,255,137,153,61,29,0,0,0,0,73,69,78,68,174,66,96,130]);
  const form=new FormData();form.append("file",new Blob([bytes],{type:"image/png"}),"staging-test.png");form.append("tipo","avatar");
  const up=await fetch(API+"/api/v1/files/upload",{method:"POST",headers:{Authorization:"Bearer "+token},body:form});
  const upData=await up.json();if(!up.ok||!upData.file||!upData.file.id)throw new Error("Upload falhou (HTTP "+up.status+"): "+(upData.error||"resposta inválida"));
  fileId=upData.file.id;log("Upload R2 + metadados D1: OK. ID temporário: "+fileId);
  const down=await fetch(API+"/api/v1/files/"+encodeURIComponent(fileId),{headers:{Authorization:"Bearer "+token},cache:"no-store"});
  if(!down.ok)throw new Error("Download falhou (HTTP "+down.status+").");
  const got=new Uint8Array(await down.arrayBuffer());
  if(got.length!==bytes.length||got.some((v,i)=>v!==bytes[i]))throw new Error("Integridade do arquivo: conteúdo diferente do enviado.");
  log("Download e comparação byte a byte: OK ("+got.length+" bytes).");
  const del=await fetch(API+"/api/v1/files/"+encodeURIComponent(fileId),{method:"DELETE",headers:{Authorization:"Bearer "+token}});
  const delData=await del.json();if(!del.ok||!delData.deleted)throw new Error("Exclusão falhou (HTTP "+del.status+").");
  deleted=true;log("Exclusão no D1/R2: OK.");
  const check=await fetch(API+"/api/v1/files/"+encodeURIComponent(fileId),{headers:{Authorization:"Bearer "+token},cache:"no-store"});
  if(check.status!==404)throw new Error("Verificação pós-exclusão inesperada: HTTP "+check.status);
  log("Verificação pós-exclusão: HTTP 404, arquivo não acessível.");
  out.textContent="SUCESSO — teste completo.\n"+out.textContent;
 }catch(e){
  log("FALHA: "+e.message);
  if(fileId&&!deleted){try{const clean=await fetch(API+"/api/v1/files/"+encodeURIComponent(fileId),{method:"DELETE",headers:{Authorization:"Bearer "+token}});if(clean.ok){deleted=true;log("Limpeza automática do arquivo temporário: OK.");}else log("ATENÇÃO: limpeza automática não confirmada (HTTP "+clean.status+").");}catch(_){log("ATENÇÃO: não foi possível confirmar a limpeza automática.");}}
 }finally{
  try{await supabase.auth.signOut({scope:"local"});}catch(_){}
  try{sessionStorage.removeItem(STORAGE_KEY);}catch(_){}
  btn.disabled=false;
 }
}
btn.addEventListener("click",async()=>{
 btn.disabled=true;out.textContent="Redirecionando para o login seguro do Google…";
 const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});
 if(error){out.textContent="Não foi possível iniciar o Google: "+error.message;btn.disabled=false;}
});
(async()=>{
 const params=new URLSearchParams(location.search);
 if(params.has("error")){out.textContent="Login não concluído: "+(params.get("error_description")||params.get("error"));return;}
 const {data,error}=await supabase.auth.getSession();
 if(error){out.textContent="Erro ao recuperar a sessão Google: "+error.message;return;}
 if(data.session&&data.session.access_token){btn.disabled=true;await runTest(data.session.access_token);}
 else out.textContent="Pronto. Toque em “Continuar com Google e testar”.";
})().catch(e=>{out.textContent="Falha ao iniciar o teste: "+(e&&e.message?e.message:String(e));btn.disabled=false;});
</script></html>`
  const h=new Headers(headers);h.set("Content-Type","text/html; charset=utf-8");h.set("Cache-Control","no-store");h.set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline' https://esm.sh; connect-src 'self' https://jxzcuqwlnqxnhftffbjx.supabase.co; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  return new Response(html,{status:200,headers:h});
 }
 if(!url.pathname.startsWith("/api/v1/"))return json({ok:false,error:"Not found"},404,headers);
 if(url.pathname==="/api/v1/me/bootstrap"&&request.method==="POST"){
   let identity;
   try{identity=await authenticate(request,env);}catch(_){return json({ok:false,error:"Serviço de autenticação indisponível."},503,headers);}
   if(identity.error)return json({ok:false,error:"Sessão não confirmada."},identity.error==="upstream"?503:401,headers);
   try{await bootstrapProfile(env,identity.user);}catch(_){return json({ok:false,error:"Não foi possível preparar o perfil."},503,headers);}
 }
 const access=await requireUser(request,env,headers);if(access.response)return access.response;const uid=access.user.id;
 const isAdmin=Number(access.profile.is_admin)===1||Number(access.profile.admin_principal)===1||String(access.user.email||"").toLowerCase()==="lucasviniciusfk@gmail.com";

 const profileRequest=url.pathname==="/api/v1/me/bootstrap"?new Request(url.origin+"/api/v1/me",{headers:request.headers}):request;
 const settingsResponse=await handleSettings(request,env,{uid,headers,isAdmin});if(settingsResponse)return settingsResponse;
 const libraryResponse=await handleLibrary(request,env,{uid,headers,isAdmin});if(libraryResponse)return libraryResponse;
 const achievementResponse=await handleAchievements(request,env,{uid,headers,email:access.user.email||access.profile.email});if(achievementResponse)return achievementResponse;
 const profileResponse=await handleProfile(profileRequest,env,{uid,headers,authUser:access.user});if(profileResponse)return profileResponse;
 const snapshotResponse=await handleSnapshot(request,env,{uid,headers});if(snapshotResponse)return snapshotResponse;
 const chatResponse=await handleChat(request,env,{uid,headers,isAdmin});if(chatResponse)return chatResponse;
 const challengesResponse=await handleChallenges(request,env,{uid,headers,isAdmin});if(challengesResponse)return challengesResponse;

 // Mural do Clube: membros leem e reagem; somente admins publicam e moderam.
 const muralRoute=url.pathname.match(/^\/api\/v1\/club\/mural(?:\/([^/]+)(?:\/reaction)?)?$/);
 if(muralRoute){
  const postId=muralRoute[1]?decodeURIComponent(muralRoute[1]):"";
  const isReaction=url.pathname.endsWith("/reaction");
  if(postId.length>128)return json({ok:false,error:"ID da publicação inválido."},400,headers);
  if(!postId&&!isReaction&&request.method==="GET"){
   const limit=clampInt(url.searchParams.get("limit"),200,1,300),includeInactive=isAdmin&&url.searchParams.get("include_inactive")==="1";
   const posts=await env.DB.prepare("SELECT id,tipo,titulo,texto,fixado,automatico,cor,ativo,autor_id,autor_nome,criado_em,atualizado_em FROM clube_mural WHERE (?=1 OR COALESCE(ativo,1)=1) ORDER BY COALESCE(fixado,0) DESC,criado_em DESC,id DESC LIMIT ?").bind(includeInactive?1:0,limit).all();
   const reactions=await env.DB.prepare("SELECT id,post_id,usuario_id,usuario_nome,criado_em FROM clube_mural_reacoes ORDER BY criado_em DESC,id DESC LIMIT 3000").all();
   return json({ok:true,posts:posts.results||[],reactions:reactions.results||[],count:(posts.results||[]).length,limit},200,headers);
  }
  if(!postId&&!isReaction&&request.method==="POST"){
   if(!isAdmin)return json({ok:false,error:"Somente a administração pode publicar no Mural."},403,headers);
   const body=await readBody(request),title=validText(body.title??body.titulo??"Aviso",160,"Título",true),message=validText(body.text??body.texto??"",12000,"Mensagem"),type=validText(body.type??body.tipo??"aviso",32,"Tipo",true),color=validText(body.color??body.cor??"",32,"Cor");
   const pinned=body.pinned===true||body.pinned===1||String(body.pinned).toLowerCase()==="true",stamp=new Date().toISOString(),id=crypto.randomUUID();
   const author=await env.DB.prepare("SELECT nome FROM usuarios WHERE id=? LIMIT 1").bind(uid).first();
   await env.DB.prepare("INSERT INTO clube_mural(id,tipo,titulo,texto,fixado,automatico,cor,ativo,autor_id,autor_nome,criado_em,atualizado_em) VALUES(?,?,?,?,?,0,?,1,?,?,?,?)").bind(id,type,title,message,pinned?1:0,color||null,uid,String(author&&author.nome||access.user.email||"Admin"),stamp,stamp).run();
   const post=await env.DB.prepare("SELECT id,tipo,titulo,texto,fixado,automatico,cor,ativo,autor_id,autor_nome,criado_em,atualizado_em FROM clube_mural WHERE id=? LIMIT 1").bind(id).first();
   return json({ok:true,post},201,headers);
  }
  if(postId&&!isReaction&&(request.method==="PATCH"||request.method==="PUT")){
   if(!isAdmin)return json({ok:false,error:"Somente a administração pode editar o Mural."},403,headers);
   const old=await env.DB.prepare("SELECT * FROM clube_mural WHERE id=? LIMIT 1").bind(postId).first();if(!old)return json({ok:false,error:"Publicação não encontrada."},404,headers);
   const body=await readBody(request),has=(...keys)=>keys.some(key=>Object.prototype.hasOwnProperty.call(body,key)),pick=(keys,fallback)=>{for(const key of keys)if(Object.prototype.hasOwnProperty.call(body,key))return body[key];return fallback;};
   const title=validText(pick(["title","titulo"],old.titulo),160,"Título",true),message=validText(pick(["text","texto"],old.texto),12000,"Mensagem"),type=validText(pick(["type","tipo"],old.tipo),32,"Tipo",true),color=validText(pick(["color","cor"],old.cor||""),32,"Cor"),pinned=has("pinned","fixado")?(pick(["pinned","fixado"],false)===true||pick(["pinned","fixado"],false)===1||String(pick(["pinned","fixado"],false)).toLowerCase()==="true"):(Number(old.fixado)===1),active=has("active","ativo")?(pick(["active","ativo"],true)===true||pick(["active","ativo"],true)===1||String(pick(["active","ativo"],true)).toLowerCase()==="true"):(Number(old.ativo)!==0),stamp=new Date().toISOString();
   const updated=await env.DB.prepare("UPDATE clube_mural SET tipo=?,titulo=?,texto=?,fixado=?,cor=?,ativo=?,atualizado_em=? WHERE id=?").bind(type,title,message,pinned?1:0,color||null,active?1:0,stamp,postId).run();
   if(Number(updated.meta?.changes)!==1)return json({ok:false,error:"Alteração da publicação não foi confirmada."},409,headers);
   const post=await env.DB.prepare("SELECT id,tipo,titulo,texto,fixado,automatico,cor,ativo,autor_id,autor_nome,criado_em,atualizado_em FROM clube_mural WHERE id=? LIMIT 1").bind(postId).first();
   return json({ok:true,post},200,headers);
  }
  if(postId&&!isReaction&&request.method==="DELETE"){
   if(!isAdmin)return json({ok:false,error:"Somente a administração pode remover publicações."},403,headers);
   const stamp=new Date().toISOString(),updated=await env.DB.prepare("UPDATE clube_mural SET ativo=0,atualizado_em=? WHERE id=? AND COALESCE(ativo,1)=1").bind(stamp,postId).run();
   if(Number(updated.meta?.changes)!==1)return json({ok:false,error:"Publicação não encontrada."},404,headers);
   return json({ok:true,removed:true,id:postId},200,headers);
  }
  if(postId&&isReaction&&request.method==="PUT"){
   const id="mural-reaction:"+uid+":"+postId,stamp=new Date().toISOString(),author=await env.DB.prepare("SELECT nome FROM usuarios WHERE id=? LIMIT 1").bind(uid).first();
   const added=await env.DB.prepare("INSERT OR IGNORE INTO clube_mural_reacoes(id,post_id,usuario_id,usuario_nome,criado_em) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM clube_mural WHERE id=? AND COALESCE(ativo,1)=1) AND NOT EXISTS(SELECT 1 FROM clube_mural_reacoes WHERE post_id=? AND usuario_id=?)").bind(id,postId,uid,String(author&&author.nome||access.user.email||"Membro"),stamp,postId,postId,uid).run();
   const reaction=await env.DB.prepare("SELECT id,post_id,usuario_id,usuario_nome,criado_em FROM clube_mural_reacoes WHERE post_id=? AND usuario_id=? ORDER BY criado_em DESC,id DESC LIMIT 1").bind(postId,uid).first();
   if(!reaction)return json({ok:false,error:"Não foi possível registrar a reação."},409,headers);
   return json({ok:true,added:Number(added.meta?.changes)===1,reaction},200,headers);
  }
  if(postId&&isReaction&&request.method==="DELETE"){
   const removed=await env.DB.prepare("DELETE FROM clube_mural_reacoes WHERE post_id=? AND usuario_id=?").bind(postId,uid).run();
   return json({ok:true,removed:Number(removed.meta?.changes)||0},200,headers);
  }
  return json({ok:false,error:"Método não permitido."},405,headers);
 }

 // Recompensas periódicas: replica as regras v507/v512, com identidade derivada da sessão.
 if(url.pathname==="/api/v1/rewards/period"&&request.method==="POST"){
  try{
   const body=await readBody(request),kind=validText(body.kind,10,"Tipo",true).toLowerCase(),period=validText(body.period_key,10,"Período",true);
   if(kind!=="weekly"&&kind!=="monthly")return json({ok:false,error:"Tipo de meta periódica inválido."},400,headers);
   let start,end,weeklyStart=period;
   if(kind==="weekly"){
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(period)||Number.isNaN(Date.parse(period+"T00:00:00Z"))||new Date(period+"T00:00:00Z").toISOString().slice(0,10)!==period)return json({ok:false,error:"Período semanal inválido."},400,headers);
    start=new Date(period+"T00:00:00Z");end=new Date(start.getTime()+7*86400000);
   }else{
    if(!/^[0-9]{4}-[0-9]{2}$/.test(period)||Number.isNaN(Date.parse(period+"-01T00:00:00Z"))||new Date(period+"-01T00:00:00Z").toISOString().slice(0,7)!==period)return json({ok:false,error:"Período mensal inválido."},400,headers);
    start=new Date(period+"-01T00:00:00Z");end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1));
   }
   const rewardRow=await env.DB.prepare("SELECT valor,atualizado_em FROM app_configuracoes WHERE chave=? AND usuario_id IN ('global','00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000181') ORDER BY atualizado_em DESC LIMIT 1").bind(kind==="weekly"?"meta_semanal":"meta_mensal").first();
   const rewardConfig=parseObject(rewardRow&&rewardRow.valor);
   if(!rewardRow||rewardConfig.active===false||rewardConfig.ativa===false)return json({ok:false,applied:false,reason:"goal_inactive"},200,headers);
   if(kind==="weekly"){
    const monday=new Date(period+"T00:00:00Z"),sunday=new Date(monday.getTime()+6*86400000),updated=Number(rewardConfig.updatedAt)||Date.parse(rewardConfig.atualizado_em||rewardRow.atualizado_em||"");
    if(Number.isFinite(updated)&&updated>monday.getTime()&&updated<=sunday.getTime()+86400000){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Manaus",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(updated)),date={};parts.forEach(x=>date[x.type]=x.value);const changed=date.year+"-"+date.month+"-"+date.day;if(changed>period&&changed<=sunday.toISOString().slice(0,10))weeklyStart=changed;}
    start=new Date(weeklyStart+"T00:00:00Z");
   }
   // O RPC original interpreta os limites de período no fuso America/Manaus (UTC-4).
   const from=new Date(start.getTime()+4*3600000).toISOString(),to=new Date(end.getTime()+4*3600000).toISOString();
   let target=Math.floor(Number(rewardConfig.target??rewardConfig.meta??rewardConfig.valor));
   const xpAdd=Math.max(0,Math.floor(Number(rewardConfig.rewardXp??rewardConfig.xp??rewardConfig.xp_recompensa)||0)),pointsAdd=Math.max(0,Math.floor(Number(rewardConfig.rewardPoints??rewardConfig.pontos??rewardConfig.estrelinhas)||0));
   if(!Number.isFinite(target)||target<1)return json({ok:false,error:"Configuração de meta inválida."},422,headers);
   let current=0;
   if(kind==="weekly"){
    const type=String(rewardConfig.tipo||rewardConfig.type||"paginas").toLowerCase();
    if(type.includes("pagina")){
     const verified=await env.DB.prepare("SELECT COALESCE(SUM(MAX(0,paginas_lidas)),0) AS total FROM metas_diarias WHERE usuario_id=? AND data>=? AND data<?").bind(uid,weeklyStart,end.toISOString().slice(0,10)).first();
     current=Number(verified&&verified.total)||0;
    }else if(type.includes("livro")){
     const verified=await env.DB.prepare("SELECT COUNT(DISTINCT COALESCE(NULLIF(livro_id,''),NULLIF(json_extract(dados,'$.book_id'),''),id)) AS total FROM solicitacoes_validacao WHERE usuario_id=? AND lower(status) IN ('approved','aprovado','aprovada') AND COALESCE(origem,'') NOT LIKE 'auto_reward_%' AND COALESCE(revisado_em,created_at)>=? AND COALESCE(revisado_em,created_at)<? AND (lower(tipo) LIKE '%finish%' OR lower(tipo) LIKE '%finaliz%')").bind(uid,from,to).first();
     current=Number(verified&&verified.total)||0;
    }else return json({ok:false,applied:false,reason:"manual_review_required"},200,headers);
   }
   let verifiedCurrent=current,monthlyType=null;
   if(kind==="monthly"){
    const cfg=await env.DB.prepare("SELECT valor FROM app_configuracoes WHERE chave='meta_mensal' AND usuario_id IN ('global','00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000181') ORDER BY atualizado_em DESC LIMIT 1").first();
    const cfgValue=parseObject(cfg&&cfg.valor);
    monthlyType=String(cfgValue.tipo||cfgValue.type||"livros").toLowerCase();
    if(monthlyType.includes("pagina")){
     const row=await env.DB.prepare("SELECT COALESCE(SUM(MAX(0,paginas_lidas)),0) AS total FROM metas_diarias WHERE usuario_id=? AND data>=? AND data<?").bind(uid,period+"-01",new Date(end.getTime()).toISOString().slice(0,10)).first();
     verifiedCurrent=Number(row&&row.total)||0;
    }else if(monthlyType.includes("manual")){
     verifiedCurrent=0;
    }else{
     const row=await env.DB.prepare(`SELECT COUNT(DISTINCT COALESCE(NULLIF(json_extract(dados,'$.v511_cycle_id'),''),NULLIF(json_extract(dados,'$.v508_resolved_book_id'),''),NULLIF(json_extract(dados,'$.book_id'),''),NULLIF(json_extract(dados,'$.livro_id'),''),NULLIF(lower(trim(COALESCE(json_extract(dados,'$.bookTitle'),json_extract(dados,'$.livro_titulo'),''))),''),id)) AS total
      FROM solicitacoes_validacao
      WHERE usuario_id=? AND lower(status) IN ('approved','aprovado','aprovada')
      AND lower(COALESCE(json_extract(dados,'$.system_hidden'),'false')) NOT IN ('true','1')
      AND COALESCE(origem,'') NOT LIKE 'auto_reward_%'
      AND (lower(COALESCE(json_extract(dados,'$.v512_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v511_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v510_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v509_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v508_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v507_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v506_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v483_monthly_applied'),'false')) IN ('true','1') OR COALESCE(json_extract(dados,'$.v483_book_finalized_at'),'')<>'' OR COALESCE(json_extract(dados,'$.finishApprovedAt'),'')<>'')
      AND substr(COALESCE(json_extract(dados,'$.v512_approved_at'),json_extract(dados,'$.v511_approved_at'),json_extract(dados,'$.v510_approved_at'),json_extract(dados,'$.v509_approved_at'),json_extract(dados,'$.v508_approved_at'),json_extract(dados,'$.v507_approved_at'),json_extract(dados,'$.v506_approved_at'),json_extract(dados,'$.v483_book_finalized_at'),json_extract(dados,'$.finishApprovedAt'),created_at),1,7)=?
      AND ((lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')||'|'||COALESCE(json_extract(dados,'$.v508_type'),'')||'|'||COALESCE(json_extract(dados,'$.v506_type'),'')) LIKE '%finish%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%finaliz%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%club_finish%')
       OR ((lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%monthly%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%mensal%') AND COALESCE(json_extract(dados,'$.bookTitle'),json_extract(dados,'$.livro_titulo'),json_extract(dados,'$.v508_resolved_book_id'),json_extract(dados,'$.book_id'),json_extract(dados,'$.livro_id'),'')<>''))
      AND (? NOT LIKE '%clube%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%club_finish%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%livro do clube%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%clube%')`).bind(uid,period,monthlyType).first();
     verifiedCurrent=Number(row&&row.total)||0;
    }
    current=verifiedCurrent;
   }
   if(current<Math.max(1,target))return json({ok:false,applied:false,reason:"target_not_reached",verified_current:current},200,headers);
   const origin="auto_reward_v507:"+kind+":"+period;
   const existing=await env.DB.prepare("SELECT id FROM solicitacoes_validacao WHERE usuario_id=? AND origem=? LIMIT 1").bind(uid,origin).first();
   if(existing){const u=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=? LIMIT 1").bind(uid).first();return json({ok:true,applied:false,already_rewarded:true,xp_added:0,points_added:0,xp:Number(u&&u.xp)||0,points:Number(u&&u.pontos)||0},200,headers);}
   const manual=await env.DB.prepare("SELECT id FROM solicitacoes_validacao WHERE usuario_id=? AND created_at>=? AND created_at<? AND lower(status) IN ('approved','aprovado','aprovada') AND ((?='weekly' AND (lower(tipo) LIKE '%seman%' OR lower(COALESCE(json_extract(dados,'$.request_kind'),''))='weekly')) OR (?='monthly' AND (lower(tipo) LIKE '%mens%' OR lower(COALESCE(json_extract(dados,'$.request_kind'),''))='monthly'))) AND (lower(COALESCE(json_extract(dados,'$.v507_reward_applied'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v506_reward_applied'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v491_reward_applied'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v488_reward_applied'),'false')) IN ('true','1')) LIMIT 1").bind(uid,from,to,kind,kind).first();
   if(manual){const u=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=? LIMIT 1").bind(uid).first();return json({ok:true,applied:false,already_rewarded:true,manual_reward_exists:true,xp_added:0,points_added:0,xp:Number(u&&u.xp)||0,points:Number(u&&u.pontos)||0},200,headers);}
   const user=await env.DB.prepare("SELECT nome,xp,pontos FROM usuarios WHERE id=? LIMIT 1").bind(uid).first();
   if(!user)return json({ok:false,error:"Perfil não encontrado."},404,headers);
   const claim="period:"+uid+":"+kind+":"+period,stamp=new Date().toISOString(),requestId=crypto.randomUUID();
   const rewardData=JSON.stringify({system_hidden:true,v512_system_reward:true,v512_reward_applied:true,v512_reward_applied_at:stamp,v512_period_reward_key:kind+":"+period,request_kind:kind,current:current,target:target});
   const results=await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO entrel_reward_claims_v510 (claim_key,usuario_id,source_type,source_id,xp,pontos,applied,created_at) VALUES (?,?,?,?,?,?,0,?)").bind(claim,uid,"period-goal",period,xpAdd,pointsAdd,stamp),
    env.DB.prepare("UPDATE usuarios SET xp=COALESCE(xp,0)+?,pontos=COALESCE(pontos,0)+?,atualizado_em=? WHERE id=? AND EXISTS (SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0)").bind(xpAdd,pointsAdd,stamp,uid,claim),
    env.DB.prepare("INSERT INTO solicitacoes_validacao (id,usuario_id,usuario_nome,tipo,status,origem,resenha,xp,pontos,dados,created_at,updated_at,criado_em) SELECT ?,?,?, 'system_reward','approved',?,'Registro automático interno da meta. Não requer revisão administrativa.',?,?,?, ?,?,? WHERE EXISTS (SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0)").bind(requestId,uid,user.nome||"Membro",origin,xpAdd,pointsAdd,rewardData,stamp,stamp,stamp,claim),
    env.DB.prepare("UPDATE entrel_reward_claims_v510 SET applied=1,applied_at=? WHERE claim_key=? AND applied=0").bind(stamp,claim)
   ]);
   const claimRow=await env.DB.prepare("SELECT applied,xp,pontos FROM entrel_reward_claims_v510 WHERE claim_key=?").bind(claim).first();
   const updated=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=? LIMIT 1").bind(uid).first();
   const applied=!!results[1]&&!!results[1].meta&&Number(results[1].meta.changes)>0;
   return json({ok:true,applied,already_rewarded:!applied,xp_added:applied?Number(claimRow.xp)||0:0,points_added:applied?Number(claimRow.pontos)||0:0,xp:Number(updated&&updated.xp)||0,points:Number(updated&&updated.pontos)||0,period_key:period,verified_current:current},200,headers);
  }catch(e){return json({ok:false,error:e&&e.message?e.message:"Não foi possível processar a recompensa periódica."},400,headers);}
 }
 // Recompensa diária de EPUB: o usuário é sempre obtido da sessão; claim único evita pagamento duplicado.
 if(url.pathname==="/api/v1/rewards/daily-epub"&&request.method==="POST"){
  try{
   const body=await readBody(request),day=validText(body.date,10,"Data",true);
   if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day)||Number.isNaN(Date.parse(day+"T00:00:00Z"))||new Date(day+"T00:00:00Z").toISOString().slice(0,10)!==day)return json({ok:false,error:"Data inválida."},400,headers);
   const goal=await env.DB.prepare("SELECT paginas_lidas,concluida,recompensada,origem FROM metas_diarias WHERE usuario_id=? AND data=? LIMIT 1").bind(uid,day).first();
   if(!goal)return json({ok:false,applied:false,reason:"meta_not_found"},200,headers);
   const pages=Number(goal.paginas_lidas)||0,done=goal.concluida===1||goal.concluida===true||pages>=20,origin=String(goal.origem||"");
   if(!done||pages<20)return json({ok:false,applied:false,reason:"meta_not_completed"},200,headers);
   if(goal.recompensada===1||goal.recompensada===true){const current=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=? LIMIT 1").bind(uid).first();return json({ok:true,applied:false,already_rewarded:true,xp_added:0,points_added:0,xp:Number(current&&current.xp)||0,points:Number(current&&current.pontos)||0},200,headers);}
   if(!/(leitor|reader|epub|auto_pending_admin)/i.test(origin))return json({ok:false,applied:false,reason:"invalid_origin"},200,headers);
   const claim="daily-epub:"+uid+":"+day,stamp=new Date().toISOString();
   const results=await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO entrel_reward_claims_v510 (claim_key,usuario_id,source_type,source_id,xp,pontos,applied,created_at) SELECT ?,?,?,?,20,10,0,? WHERE EXISTS (SELECT 1 FROM metas_diarias WHERE usuario_id=? AND data=? AND paginas_lidas>=20 AND (concluida=1 OR concluida IS TRUE OR paginas_lidas>=20))").bind(claim,uid,"daily-epub",day,stamp,uid,day),
    env.DB.prepare("UPDATE usuarios SET xp=COALESCE(xp,0)+20,pontos=COALESCE(pontos,0)+10,atualizado_em=? WHERE id=? AND EXISTS (SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0)").bind(stamp,uid,claim),
    env.DB.prepare("UPDATE metas_diarias SET meta_paginas=20,recompensada=1,concluida=1,concluida_em=COALESCE(concluida_em,?),atualizado_em=? WHERE usuario_id=? AND data=? AND EXISTS (SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0)").bind(stamp,stamp,uid,day,claim),
    env.DB.prepare("UPDATE entrel_reward_claims_v510 SET applied=1,applied_at=? WHERE claim_key=? AND applied=0").bind(stamp,claim)
   ]);
   const [c,p]=await Promise.all([
    env.DB.prepare("SELECT applied,xp,pontos FROM entrel_reward_claims_v510 WHERE claim_key=? LIMIT 1").bind(claim).first(),
    env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=? LIMIT 1").bind(uid).first()
   ]);
   if(!c)return json({ok:false,applied:false,reason:"meta_not_eligible"},200,headers);
   const applied=!!results[1]&&!!results[1].meta&&Number(results[1].meta.changes)>0;
   return json({ok:true,applied,already_rewarded:!applied,xp_added:applied?20:0,points_added:applied?10:0,xp:Number(p&&p.xp)||0,points:Number(p&&p.pontos)||0,target:20},200,headers);
  }catch(_){return json({ok:false,error:"Não foi possível processar a recompensa diária."},500,headers);}
 }
 // Arquivos privados: o proprietário vem exclusivamente da sessão validada.
 // Associação privada entre arquivos R2 e livros pessoais. IDs legados são preservados.
 const bookAssetsRoute=url.pathname.match(/^\/api\/v1\/library\/books\/([^/]+)\/assets$/);
 if(bookAssetsRoute&&request.method==="GET"){
  try{
   const bookId=decodeURIComponent(bookAssetsRoute[1]);
   const book=await env.DB.prepare("SELECT id FROM livros_pessoais WHERE id=? AND usuario_id=? AND COALESCE(ativo,1)=1 LIMIT 1").bind(bookId,uid).first();
   if(!book)return json({ok:false,error:"Livro ativo não encontrado."},404,headers);
   const result=await env.DB.prepare("SELECT l.id,l.role,l.asset_id,l.created_at,a.original_name,a.content_type,a.size_bytes FROM book_file_assets l JOIN file_assets a ON a.id=l.asset_id AND a.owner_id=l.owner_id WHERE l.owner_id=? AND l.book_id=? AND l.deleted_at IS NULL AND a.deleted_at IS NULL ORDER BY l.created_at DESC").bind(uid,bookId).all();
   return json({ok:true,items:result.results||[]},200,headers);
  }catch(_){return json({ok:false,error:"Não foi possível consultar os arquivos do livro."},500,headers);}
 }
 if(bookAssetsRoute&&request.method==="POST"){
  try{
   const bookId=decodeURIComponent(bookAssetsRoute[1]),body=await readBody(request);
   const role=String(body.role||"").toLowerCase(),assetId=validText(body.file_id,128,"ID do arquivo",true);
   if(!["epub","cover"].includes(role))return json({ok:false,error:"Função do arquivo inválida."},400,headers);
   const book=await env.DB.prepare("SELECT id FROM livros_pessoais WHERE id=? AND usuario_id=? AND COALESCE(ativo,1)=1 LIMIT 1").bind(bookId,uid).first();
   if(!book)return json({ok:false,error:"Livro ativo não encontrado."},404,headers);
   const asset=await env.DB.prepare("SELECT id,category FROM file_assets WHERE id=? AND owner_id=? AND deleted_at IS NULL LIMIT 1").bind(assetId,uid).first();
   if(!asset)return json({ok:false,error:"Arquivo privado não encontrado."},404,headers);
   if((role==="epub"&&asset.category!=="epub")||(role==="cover"&&asset.category!=="cover"))return json({ok:false,error:"A categoria do arquivo não corresponde à função solicitada."},400,headers);
   const linkId=crypto.randomUUID(),stamp=new Date().toISOString();
   await env.DB.batch([
    env.DB.prepare("UPDATE book_file_assets SET deleted_at=? WHERE owner_id=? AND book_id=? AND role=? AND deleted_at IS NULL").bind(stamp,uid,bookId,role),
    env.DB.prepare("INSERT INTO book_file_assets (id,owner_id,book_id,asset_id,role,created_at) VALUES (?,?,?,?,?,?)").bind(linkId,uid,bookId,assetId,role,stamp)
   ]);
   return json({ok:true,link:{id:linkId,book_id:bookId,file_id:assetId,role:role,created_at:stamp}},201,headers);
  }catch(error){const msg=String(error&&error.message||error);return json({ok:false,error:/obrigatório|inválida|limite/i.test(msg)?msg:"Não foi possível associar o arquivo ao livro."},400,headers);}
 }
 const fileRoute=url.pathname.match(/^\/api\/v1\/files\/([^/]+)$/);
 if(request.method==="POST"&&url.pathname==="/api/v1/files/upload"){
  try{
   const form=await request.formData(),file=form.get("file"),rawType=String(form.get("tipo")||"").toLowerCase();
   const categories={"epub":"epub","capa":"cover","cover":"cover","avatar":"avatar","foto-encontro":"club-photo","club-photo":"club-photo","comprovante":"receipt","receipt":"receipt"};
   const category=categories[rawType];
   if(!category||!(file instanceof File))return json({ok:false,error:"Arquivo ou categoria inválida."},400,headers);
   const mime=String(file.type||"application/octet-stream").toLowerCase();
   const allowed={"epub":["application/epub+zip","application/octet-stream"],"cover":["image/jpeg","image/png","image/webp"],"avatar":["image/jpeg","image/png","image/webp"],"club-photo":["image/jpeg","image/png","image/webp"],"receipt":["image/jpeg","image/png","image/webp","application/pdf"]};
   const max=category==="epub"?25*1024*1024:category==="receipt"?10*1024*1024:5*1024*1024;
   if(!allowed[category].includes(mime))return json({ok:false,error:"Tipo de arquivo não permitido."},415,headers);
   if(file.size<1||file.size>max)return json({ok:false,error:"Tamanho do arquivo fora do limite permitido."},413,headers);
   const id=crypto.randomUUID(),stamp=new Date().toISOString(),safeName=String(file.name||"arquivo").replace(/[^a-zA-Z0-9._-]/g,"_").slice(-120)||"arquivo";
   const key=uid+"/"+category+"/"+id;
   await env.FILES.put(key,file.stream(),{httpMetadata:{contentType:mime},customMetadata:{ownerId:uid,category:category,assetId:id}});
   try{
    await env.DB.prepare("INSERT INTO file_assets (id,owner_id,object_key,category,original_name,content_type,size_bytes,created_at) VALUES (?,?,?,?,?,?,?,?)").bind(id,uid,key,category,safeName,mime,file.size,stamp).run();
   }catch(e){await env.FILES.delete(key);throw e;}
   return json({ok:true,file:{id:id,category:category,name:safeName,content_type:mime,size_bytes:file.size,created_at:stamp}},201,headers);
  }catch(e){console.error(JSON.stringify({event:"file_upload_failed",message:String(e&&e.message||e)}));return json({ok:false,error:"Não foi possível armazenar o arquivo no staging."},500,headers);}
 }
 if(fileRoute&&request.method==="GET"){
  try{
   const id=decodeURIComponent(fileRoute[1]),asset=await env.DB.prepare("SELECT id,owner_id,object_key,content_type,original_name,size_bytes FROM file_assets WHERE id=? AND deleted_at IS NULL AND (owner_id=? OR (?=1 AND category='receipt' AND EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE origem='challenge_cf_v1' AND comprovante='cf-asset:'||file_assets.id))) LIMIT 1").bind(id,uid,isAdmin?1:0).first();
   if(!asset)return json({ok:false,error:"Arquivo não encontrado."},404,headers);
   const object=await env.FILES.get(asset.object_key);if(!object)return json({ok:false,error:"Arquivo indisponível no armazenamento."},404,headers);
   const outHeaders=new Headers(headers);outHeaders.set("Content-Type",asset.content_type);outHeaders.set("Content-Length",String(asset.size_bytes));outHeaders.set("Content-Disposition",'inline; filename="'+asset.original_name.replace(/["\\\r\n]/g,"_")+'"');outHeaders.set("Cache-Control","private, no-store");outHeaders.set("X-Content-Type-Options","nosniff");
   return new Response(object.body,{status:200,headers:outHeaders});
  }catch(e){return json({ok:false,error:"Não foi possível recuperar o arquivo."},500,headers);}
 }
 if(fileRoute&&request.method==="DELETE"){
  try{
   const id=decodeURIComponent(fileRoute[1]),asset=await env.DB.prepare("SELECT id,object_key,deleted_at FROM file_assets WHERE id=? AND owner_id=? LIMIT 1").bind(id,uid).first();
   if(!asset)return json({ok:false,error:"Arquivo não encontrado."},404,headers);
   if(!asset.deleted_at){
    const [book,photo,avatar,challengeProof]=await Promise.all([
     env.DB.prepare("SELECT id FROM book_file_assets WHERE asset_id=? AND deleted_at IS NULL LIMIT 1").bind(id).first(),
     env.DB.prepare("SELECT id FROM clube_fotos WHERE storage_path=? AND origem_arquivo='r2-private-v1' AND COALESCE(ativo,1)=1 LIMIT 1").bind(id).first(),
     env.DB.prepare("SELECT id FROM usuarios WHERE foto_url=? AND COALESCE(apagado,0)=0 AND COALESCE(conta_removida,0)=0 LIMIT 1").bind("cf-asset:"+id).first(),
     env.DB.prepare("SELECT id FROM solicitacoes_validacao WHERE origem='challenge_cf_v1' AND (comprovante=? OR prova=?) LIMIT 1").bind("cf-asset:"+id,"cf-asset:"+id).first()
    ]);
    if(book||photo||avatar||challengeProof)return json({ok:false,error:"Arquivo ainda referenciado. Remova o vínculo antes de excluir."},409,headers);
   }
   // Primeiro bloqueia o acesso no D1; se a exclusão do R2 falhar, o objeto fica inacessível pela API e pode ser limpo depois.
   const stamp=new Date().toISOString();
   if(!asset.deleted_at){
    const result=await env.DB.prepare("UPDATE file_assets SET deleted_at=? WHERE id=? AND owner_id=? AND deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM book_file_assets WHERE asset_id=file_assets.id AND deleted_at IS NULL) AND NOT EXISTS(SELECT 1 FROM clube_fotos WHERE storage_path=file_assets.id AND origem_arquivo='r2-private-v1' AND COALESCE(ativo,1)=1) AND NOT EXISTS(SELECT 1 FROM usuarios WHERE foto_url='cf-asset:'||file_assets.id AND COALESCE(apagado,0)=0 AND COALESCE(conta_removida,0)=0) AND NOT EXISTS(SELECT 1 FROM solicitacoes_validacao WHERE origem='challenge_cf_v1' AND (comprovante='cf-asset:'||file_assets.id OR prova='cf-asset:'||file_assets.id))").bind(stamp,id,uid).run();
    if(!result.meta||result.meta.changes!==1)return json({ok:false,error:"Não foi possível confirmar a remoção do arquivo."},409,headers);
   }
   await env.FILES.delete(asset.object_key);
   return json({ok:true,deleted:true,id:id},200,headers);
  }catch(e){return json({ok:false,error:"Arquivo bloqueado para acesso; a limpeza do armazenamento pode precisar ser repetida."},500,headers);}
 }
 try{
  if(request.method==="GET"&&url.pathname==="/api/v1/club/current-book"){
   const row=await env.DB.prepare("SELECT id,titulo,autor,genero,paginas_total,data_encontro,horario_encontro,local_encontro,xp_recompensa,capa_url,epub_storage_path,nome_arquivo,status,ativo,criado_em,atualizado_em,prazo,descricao,pontos_recompensa FROM clube_livro_atual WHERE COALESCE(ativo,1)=1 ORDER BY atualizado_em DESC LIMIT 1").first();
   return json({ok:true,book:row||null},200,headers);
  }
  if(request.method==="GET"&&url.pathname==="/api/v1/club/library/books"){
   const limit=clampInt(url.searchParams.get("limit"),200,1,500);
   const r=await env.DB.prepare("SELECT id,titulo,autor,genero,paginas_total,capa_url,epub_storage_path,nome_arquivo,ativo,criado_por,criado_em,atualizado_em,origem_arquivo FROM clube_biblioteca WHERE COALESCE(ativo,1)=1 ORDER BY atualizado_em DESC,id DESC LIMIT ?").bind(limit).all();
   return json({ok:true,items:r.results||[],count:(r.results||[]).length,limit},200,headers);
  }
  const clubBookRoute=url.pathname.match(/^\/api\/v1\/club\/library\/books\/([^/]+)$/);
  if(request.method==="GET"&&clubBookRoute){
   const bookId=decodeURIComponent(clubBookRoute[1]);
   const row=await env.DB.prepare("SELECT id,titulo,autor,genero,paginas_total,capa_url,epub_storage_path,nome_arquivo,ativo,criado_por,criado_em,atualizado_em,origem_arquivo FROM clube_biblioteca WHERE id=? AND COALESCE(ativo,1)=1 LIMIT 1").bind(bookId).first();
   if(!row)return json({ok:false,error:"Livro não encontrado na Biblioteca do Clube."},404,headers);
   return json({ok:true,book:row},200,headers);
  }
  if(request.method==="GET"&&url.pathname==="/api/v1/library/books"){const limit=clampInt(url.searchParams.get("limit"),200,1,500),cursor=url.searchParams.get("before"),cursorId=url.searchParams.get("before_id");if((cursor&&!cursorId)||(!cursor&&cursorId))return json({ok:false,error:"Use before e before_id juntos para paginar."},400,headers);const sql="SELECT id,usuario_id,livro_id,titulo,autor,genero,paginas,capa,capa_url,epub_storage_path,pagina_atual,progresso,epub_cfi,status,ativo,dados,publico,criado_em,atualizado_em,finalizado_em FROM livros_pessoais WHERE usuario_id=? AND COALESCE(ativo,1)=1 AND (? IS NULL OR atualizado_em < ? OR (atualizado_em = ? AND id < ?)) ORDER BY atualizado_em DESC,id DESC LIMIT ?";const r=await env.DB.prepare(sql).bind(uid,cursor,cursor,cursor,cursorId,limit).all();const items=r.results||[],last=items.length?items[items.length-1]:null;return json({ok:true,items,count:items.length,limit,nextCursor:last?{before:last.atualizado_em,before_id:last.id}:null},200,headers);}
  if(request.method==="GET"&&url.pathname==="/api/v1/reading"){const limit=clampInt(url.searchParams.get("limit"),200,1,1000);const r=await env.DB.prepare("SELECT * FROM leituras WHERE usuario_id=? ORDER BY atualizado_em DESC LIMIT ?").bind(uid,limit).all();return json({ok:true,items:r.results||[],count:(r.results||[]).length,limit},200,headers);}
  if(request.method==="GET"&&url.pathname==="/api/v1/goals"){const limit=clampInt(url.searchParams.get("daily_limit"),90,1,366);const [s,d]=await Promise.all([env.DB.prepare("SELECT * FROM metas_usuarios WHERE usuario_id=? LIMIT 1").bind(uid).first(),env.DB.prepare("SELECT * FROM metas_diarias WHERE usuario_id=? ORDER BY data DESC LIMIT ?").bind(uid,limit).all()]);return json({ok:true,summary:s||null,daily:d.results||[],dailyCount:(d.results||[]).length},200,headers);}
  if(request.method==="GET"&&url.pathname==="/api/v1/progress/weekly"){
   const period=url.searchParams.get("period")||"";
   if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(period)||Number.isNaN(Date.parse(period+"T00:00:00Z"))||new Date(period+"T00:00:00Z").toISOString().slice(0,10)!==period)return json({ok:false,error:"Período semanal inválido. Use AAAA-MM-DD."},400,headers);
   const cfg=await env.DB.prepare("SELECT valor,atualizado_em FROM app_configuracoes WHERE chave='meta_semanal' AND usuario_id IN ('global','00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000181') ORDER BY atualizado_em DESC LIMIT 1").first(),goal=parseObject(cfg&&cfg.valor),type=String(goal.tipo||goal.type||"paginas").toLowerCase();
   const monday=new Date(period+"T00:00:00Z"),weekEnd=new Date(monday.getTime()+6*86400000),last=weekEnd.toISOString().slice(0,10),updated=Number(goal.updatedAt)||Date.parse(goal.atualizado_em||cfg&&cfg.atualizado_em||"");let start=period;
   if(Number.isFinite(updated)&&updated>monday.getTime()&&updated<=weekEnd.getTime()+86400000){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Manaus',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(updated)),date={};parts.forEach(x=>date[x.type]=x.value);const changed=date.year+'-'+date.month+'-'+date.day;if(changed>period&&changed<=last)start=changed;}
   const next=new Date(weekEnd.getTime()+86400000).toISOString().slice(0,10),from=new Date(Date.parse(start+"T00:00:00Z")+4*3600000).toISOString(),to=new Date(Date.parse(next+"T00:00:00Z")+4*3600000).toISOString();
   const [pageRows,booksRow]=await Promise.all([
    env.DB.prepare("SELECT COALESCE(SUM(MAX(0,COALESCE(paginas_lidas,0))),0) AS pages,COUNT(DISTINCT CASE WHEN COALESCE(paginas_lidas,0)>0 OR concluida=1 OR concluida IS TRUE THEN data END) AS days FROM metas_diarias WHERE usuario_id=? AND data>=? AND data<?").bind(uid,start,next).first(),
    env.DB.prepare("SELECT COUNT(DISTINCT COALESCE(NULLIF(livro_id,''),NULLIF(json_extract(dados,'$.book_id'),''),id)) AS books FROM solicitacoes_validacao WHERE usuario_id=? AND lower(status) IN ('approved','aprovado','aprovada') AND COALESCE(origem,'') NOT LIKE 'auto_reward_%' AND COALESCE(revisado_em,created_at)>=? AND COALESCE(revisado_em,created_at)<? AND (lower(tipo) LIKE '%finish%' OR lower(tipo) LIKE '%finaliz%')").bind(uid,from,to).first()
   ]);
   const pages=Number(pageRows&&pageRows.pages)||0,days=Number(pageRows&&pageRows.days)||0,books=Number(booksRow&&booksRow.books)||0,target=Math.max(1,Math.floor(Number(goal.target??goal.meta??goal.valor)||70));
   const current=type.includes('manual')?0:type.includes('livro')?books:type.includes('dia')?days:pages;
   return json({ok:true,period,start,end:last,type,current,target,pages,days,books,complete:!type.includes('manual')&&current>=target,active:goal.active!==false&&goal.ativa!==false},200,headers);
  }
  if(request.method==="GET"&&url.pathname==="/api/v1/progress/monthly"){
   const period=url.searchParams.get("period")||"";
   if(!/^[0-9]{4}-[0-9]{2}$/.test(period)||Number.isNaN(Date.parse(period+"-01T00:00:00Z"))||new Date(period+"-01T00:00:00Z").toISOString().slice(0,7)!==period)return json({ok:false,error:"Período mensal inválido. Use AAAA-MM."},400,headers);
   const start=period+"-01",date=new Date(start+"T00:00:00Z"),endDate=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1)).toISOString().slice(0,10);
   let kind="livros";
   try{
    const cfg=await env.DB.prepare("SELECT valor FROM app_configuracoes WHERE chave='meta_mensal' AND usuario_id IN ('global','00000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000181') ORDER BY atualizado_em DESC LIMIT 1").first();
    const value=parseObject(cfg&&cfg.valor);kind=String(value.tipo||value.type||"livros").toLowerCase();
   }catch(_){kind="livros";}
   let current=0;
   if(kind.includes("pagina")){
    const row=await env.DB.prepare("SELECT COALESCE(SUM(MAX(0,COALESCE(paginas_lidas,0))),0) AS total FROM metas_diarias WHERE usuario_id=? AND data>=? AND data<?").bind(uid,start,endDate).first();
    current=Number(row&&row.total)||0;
   }else if(!kind.includes("manual")){
    const sql="SELECT COUNT(DISTINCT COALESCE(NULLIF(json_extract(dados,'$.v511_cycle_id'),''),NULLIF(json_extract(dados,'$.v508_resolved_book_id'),''),NULLIF(json_extract(dados,'$.book_id'),''),NULLIF(json_extract(dados,'$.livro_id'),''),NULLIF(lower(trim(COALESCE(json_extract(dados,'$.bookTitle'),json_extract(dados,'$.livro_titulo'),''))),''),id)) AS total FROM solicitacoes_validacao WHERE usuario_id=? AND lower(COALESCE(status,'')) IN ('approved','aprovado','aprovada') AND lower(COALESCE(json_extract(dados,'$.system_hidden'),'false')) NOT IN ('true','1') AND COALESCE(origem,'') NOT LIKE 'auto_reward_%' AND (lower(COALESCE(json_extract(dados,'$.v512_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v511_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v510_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v509_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v508_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v507_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v506_approved'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v483_monthly_applied'),'false')) IN ('true','1') OR COALESCE(json_extract(dados,'$.v483_book_finalized_at'),'')<>'' OR COALESCE(json_extract(dados,'$.finishApprovedAt'),'')<>'') AND substr(COALESCE(json_extract(dados,'$.v512_approved_at'),json_extract(dados,'$.v511_approved_at'),json_extract(dados,'$.v510_approved_at'),json_extract(dados,'$.v509_approved_at'),json_extract(dados,'$.v508_approved_at'),json_extract(dados,'$.v507_approved_at'),json_extract(dados,'$.v506_approved_at'),json_extract(dados,'$.v483_book_finalized_at'),json_extract(dados,'$.finishApprovedAt'),created_at),1,7)=? AND (lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')||'|'||COALESCE(json_extract(dados,'$.v508_type'),'')||'|'||COALESCE(json_extract(dados,'$.v506_type'),'')) LIKE '%finish%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%finaliz%' OR (lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%monthly%' AND COALESCE(json_extract(dados,'$.bookTitle'),json_extract(dados,'$.livro_titulo'),json_extract(dados,'$.v508_resolved_book_id'),json_extract(dados,'$.book_id'),json_extract(dados,'$.livro_id'),'')<>'')) AND ( ?=0 OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%club_finish%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%livro do clube%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%clube%')";
    const row=await env.DB.prepare(sql).bind(uid,period,kind.includes("clube")?1:0).first();current=Number(row&&row.total)||0;
   }
   return json({ok:true,period,type:kind,current:Math.max(0,current)},200,headers);
  }
  // Solicitações administrativas: apenas contas explicitamente marcadas como admin.

  if(url.pathname==="/api/v1/admin/requests"&&request.method==="GET"){
   if(!isAdmin)return json({ok:false,error:"Acesso administrativo não confirmado."},403,headers);
   const limit=clampInt(url.searchParams.get("limit"),100,1,200),status=String(url.searchParams.get("status")||"pending").toLowerCase();
   const source=String(url.searchParams.get("source")||"");if(source&&source!=="personal_finish_cf_v1")return json({ok:false,error:"Filtro de origem inválido."},400,headers);
   const allowed=["pending","processing","pendente","processando","approved","approved_all","rejected"];
   if(!allowed.includes(status))return json({ok:false,error:"Filtro de status inválido."},400,headers);
   const where=status==="approved_all"?"lower(COALESCE(status,'')) IN ('approved','aprovado','aprovada')":status==="rejected"?"lower(COALESCE(status,'')) IN ('rejected','recusado','recusada')":"lower(COALESCE(status,''))=?";
   const sourceWhere=source==="personal_finish_cf_v1"?" AND origem='personal_finish_cf_v1' AND lower(COALESCE(tipo,'')) LIKE '%finish%'":"";
   const q=await env.DB.prepare("SELECT id,usuario_id,usuario_nome,tipo,livro_id,livro_titulo,paginas,status,origem,livro,resenha,prova,comprovante,dados,xp,pontos,created_at,criado_em,updated_at,atualizado_em FROM solicitacoes_validacao WHERE "+where+sourceWhere+" ORDER BY COALESCE(created_at,criado_em) DESC LIMIT ?").bind(...(status==="approved_all"||status==="rejected"?[limit]:[status,limit])).all();
   return json({ok:true,items:q.results||[],count:(q.results||[]).length},200,headers);
  }
  if(url.pathname==="/api/v1/admin/requests/reject"&&request.method==="POST"){
   if(!isAdmin)return json({ok:false,error:"Acesso administrativo não confirmado."},403,headers);
   const b=await readBody(request),requestId=validText(b.request_id,128,"ID da solicitação",true),reason=validText(b.reason||"Solicitação recusada pela administração.",1000,"Motivo");
   const req=await env.DB.prepare("SELECT id,status,dados FROM solicitacoes_validacao WHERE id=? LIMIT 1").bind(requestId).first();
   if(!req)return json({ok:false,error:"Solicitação não encontrada."},404,headers);
   const current=String(req.status||"pending").toLowerCase();
   if(["approved","aprovado","aprovada","rejected","recusado","recusada"].includes(current))return json({ok:true,applied:false,already_reviewed:true,status:current},200,headers);
   const stamp=new Date().toISOString();
   const upd=await env.DB.prepare("UPDATE solicitacoes_validacao SET status='rejected',dados=json_set(COALESCE(dados,'{}'),'$.v507_rejected',json('true'),'$.v507_rejected_at',?,'$.v507_reject_reason',?),resposta_admin=?,revisado_por=?,revisado_em=?,atualizado_em=? WHERE id=? AND lower(COALESCE(status,'pending')) NOT IN ('approved','aprovado','aprovada','rejected','recusado','recusada')").bind(stamp,reason,reason,uid,stamp,stamp,requestId).run();
   return json({ok:true,applied:Number(upd.meta&&upd.meta.changes)>0,status:"rejected"},200,headers);
  }
  if(url.pathname==="/api/v1/club/albums"&&request.method==="POST"){
   if(!isAdmin)return json({ok:false,error:"Somente a administração pode criar álbuns."},403,headers);
   const body=await readBody(request),name=validText(body.name,180,"Nome do álbum",true);
   const id=crypto.randomUUID(),stamp=new Date().toISOString();
   const date=validText(body.meeting_date||"",40,"Data do encontro"),place=validText(body.location||"",240,"Local");
   const bookTitle=validText(body.book_title||"",240,"Título do livro"),bookAuthor=validText(body.book_author||"",200,"Autor");
   const cover=validText(body.cover_url||"",2048,"Capa"),bookCover=validText(body.book_cover_url||"",2048,"Capa do livro"),dynamics=typeof body.dynamics==="string"?body.dynamics.slice(0,12000):JSON.stringify(body.dynamics||[]);
   if((cover&&!/^https:/i.test(cover))||(bookCover&&!/^https:/i.test(bookCover)))return json({ok:false,error:"As capas precisam ser URLs HTTPS."},400,headers);
   await env.DB.prepare("INSERT INTO clube_albuns(id,nome,data_encontro,local_encontro,livro_titulo,livro_autor,livro_capa_url,dinamicas,capa_url,trancado,ativo,criado_por,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,0,1,?,?,?)").bind(id,name,date,place,bookTitle,bookAuthor,bookCover,dynamics,cover,uid,stamp,stamp).run();
   return json({ok:true,album:{id,nome:name,data_encontro:date,local_encontro:place,livro_titulo:bookTitle,livro_autor:bookAuthor,livro_capa_url:bookCover,capa_url:cover,trancado:0,ativo:1,criado_em:stamp,atualizado_em:stamp}},201,headers);
  }
  const clubAlbumRoute=url.pathname.match(new RegExp("^/api/v1/club/albums/([^/]+)$"));
  if(clubAlbumRoute&&request.method==="PATCH"){
   if(!isAdmin)return json({ok:false,error:"Somente a administração pode editar álbuns."},403,headers);
   const id=decodeURIComponent(clubAlbumRoute[1]),old=await env.DB.prepare("SELECT * FROM clube_albuns WHERE id=? LIMIT 1").bind(id).first();
   if(!old)return json({ok:false,error:"Álbum não encontrado."},404,headers);
   const body=await readBody(request),name=body.name===undefined?old.nome:validText(body.name,180,"Nome do álbum",true);
   const date=body.meeting_date===undefined?old.data_encontro:validText(body.meeting_date,40,"Data do encontro");
   const place=body.location===undefined?old.local_encontro:validText(body.location,240,"Local");
   const bookTitle=body.book_title===undefined?old.livro_titulo:validText(body.book_title,240,"Título do livro");
   const bookAuthor=body.book_author===undefined?old.livro_autor:validText(body.book_author,200,"Autor");
   const cover=body.cover_url===undefined?old.capa_url:validText(body.cover_url,2048,"Capa"),bookCover=body.book_cover_url===undefined?old.livro_capa_url:validText(body.book_cover_url,2048,"Capa do livro");
   const dynamics=body.dynamics===undefined?old.dinamicas:(typeof body.dynamics==="string"?body.dynamics.slice(0,12000):JSON.stringify(body.dynamics||[]));
   const locked=body.locked===undefined?Number(old.trancado)||0:(body.locked?1:0);
   const active=body.active===undefined?Number(old.ativo)||0:(body.active?1:0);
   if((cover&&!/^https:/i.test(cover))||(bookCover&&!/^https:/i.test(bookCover)))return json({ok:false,error:"As capas precisam ser URLs HTTPS."},400,headers);
   const stamp=new Date().toISOString();
   await env.DB.prepare("UPDATE clube_albuns SET nome=?,data_encontro=?,local_encontro=?,livro_titulo=?,livro_autor=?,livro_capa_url=?,dinamicas=?,capa_url=?,trancado=?,ativo=?,atualizado_em=? WHERE id=?").bind(name,date,place,bookTitle,bookAuthor,bookCover,dynamics,cover,locked,active,stamp,id).run();
   return json({ok:true,album:{id,nome:name,data_encontro:date,local_encontro:place,livro_titulo:bookTitle,livro_autor:bookAuthor,livro_capa_url:bookCover,capa_url:cover,trancado:locked,ativo:active,atualizado_em:stamp}},200,headers);
  }
  // Biblioteca de encontros do clube: leitura autenticada, sem expor registros inativos.
  if(request.method==="GET"&&url.pathname==="/api/v1/club/albums"){
   const limit=clampInt(url.searchParams.get("limit"),100,1,200);
   const rows=await env.DB.prepare("SELECT id,nome,data_encontro,local_encontro,livro_titulo,livro_autor,livro_capa_url,dinamicas,capa_url,trancado,ativo,criado_por,criado_em,atualizado_em FROM clube_albuns WHERE COALESCE(ativo,1)=1 ORDER BY COALESCE(data_encontro,criado_em) DESC,id DESC LIMIT ?").bind(limit).all();
   return json({ok:true,items:rows.results||[],count:(rows.results||[]).length,limit},200,headers);
  }
  if(request.method==="GET"&&url.pathname==="/api/v1/club/albums/photos"){
   const albumId=validText(url.searchParams.get("album_id"),128,"Álbum",true);
   const album=await env.DB.prepare("SELECT id,trancado FROM clube_albuns WHERE id=? AND COALESCE(ativo,1)=1 LIMIT 1").bind(albumId).first();
   if(!album)return json({ok:false,error:"Álbum não encontrado."},404,headers);
   const limit=clampInt(url.searchParams.get("limit"),200,1,300);
   const rows=await env.DB.prepare("SELECT id,album_id,url,storage_path,usuario_id,usuario_nome,ativo,criado_em,foto_url,origem_arquivo FROM clube_fotos WHERE album_id=? AND COALESCE(ativo,1)=1 ORDER BY criado_em DESC,id DESC LIMIT ?").bind(albumId,limit).all();
   const items=(rows.results||[]).map(row=>Object.assign({},row,{image_url:row.origem_arquivo==="r2-private-v1"?"/api/v1/club/albums/photos/"+encodeURIComponent(row.id)+"/content":(row.url||row.foto_url||row.storage_path||"")}));
   return json({ok:true,album_id:albumId,locked:Number(album.trancado)===1,items,count:items.length,limit},200,headers);
  }
  const clubPhotoContentRoute=url.pathname.match(new RegExp("^/api/v1/club/albums/photos/([^/]+)/content$"));
  if(clubPhotoContentRoute&&request.method==="GET"){
   const photoId=decodeURIComponent(clubPhotoContentRoute[1]);
   const photo=await env.DB.prepare("SELECT f.id,f.storage_path,f.origem_arquivo FROM clube_fotos f JOIN clube_albuns a ON a.id=f.album_id WHERE f.id=? AND COALESCE(f.ativo,1)=1 AND COALESCE(a.ativo,1)=1 LIMIT 1").bind(photoId).first();
   if(!photo||photo.origem_arquivo!=="r2-private-v1"||!photo.storage_path)return json({ok:false,error:"Foto não encontrada."},404,headers);
   const asset=await env.DB.prepare("SELECT object_key,content_type,original_name,size_bytes FROM file_assets WHERE id=? AND deleted_at IS NULL LIMIT 1").bind(photo.storage_path).first();
   if(!asset)return json({ok:false,error:"Arquivo da foto indisponível."},404,headers);
   const object=await env.FILES.get(asset.object_key);if(!object)return json({ok:false,error:"Arquivo da foto indisponível no R2."},404,headers);
   const outHeaders=new Headers(headers);outHeaders.set("Content-Type",asset.content_type);outHeaders.set("Content-Length",String(asset.size_bytes));
   const safeName=String(asset.original_name||"foto").replace(/[^a-zA-Z0-9._-]/g,"_");outHeaders.set("Content-Disposition","inline; filename="+safeName);outHeaders.set("Cache-Control","private, no-store");outHeaders.set("X-Content-Type-Options","nosniff");
   return new Response(object.body,{status:200,headers:outHeaders});
  }
  if(url.pathname==="/api/v1/club/albums/photos"&&request.method==="POST"){
   const body=await readBody(request),albumId=validText(body.album_id,128,"Álbum",true),fileId=validText(body.file_id,128,"Arquivo",true);
   const album=await env.DB.prepare("SELECT id,trancado FROM clube_albuns WHERE id=? AND COALESCE(ativo,1)=1 LIMIT 1").bind(albumId).first();
   if(!album)return json({ok:false,error:"Álbum não encontrado."},404,headers);
   if(Number(album.trancado)===1&&!isAdmin)return json({ok:false,error:"O álbum está trancado para novos envios."},403,headers);
   const asset=await env.DB.prepare("SELECT id,category FROM file_assets WHERE id=? AND owner_id=? AND deleted_at IS NULL LIMIT 1").bind(fileId,uid).first();
   if(!asset||asset.category!=="club-photo")return json({ok:false,error:"Envie primeiro uma foto válida para o armazenamento privado do Clube."},404,headers);
   const existing=await env.DB.prepare("SELECT id FROM clube_fotos WHERE album_id=? AND storage_path=? AND origem_arquivo='r2-private-v1' AND COALESCE(ativo,1)=1 LIMIT 1").bind(albumId,fileId).first();
   if(existing)return json({ok:true,already_attached:true,photo_id:existing.id},200,headers);
   const user=await env.DB.prepare("SELECT nome FROM usuarios WHERE id=? LIMIT 1").bind(uid).first();
   const photoId=crypto.randomUUID(),stamp=new Date().toISOString(),name=String(user&&user.nome||access.user.email||"Membro");
   await env.DB.prepare("INSERT INTO clube_fotos(id,album_id,url,storage_path,usuario_id,usuario_nome,ativo,criado_em,foto_url,origem_arquivo) SELECT ?,?,?,?,?,?,1,?,?,? WHERE EXISTS(SELECT 1 FROM clube_albuns WHERE id=? AND COALESCE(ativo,1)=1 AND (COALESCE(trancado,0)=0 OR ?=1)) AND NOT EXISTS(SELECT 1 FROM clube_fotos WHERE album_id=? AND storage_path=? AND origem_arquivo='r2-private-v1' AND COALESCE(ativo,1)=1)").bind(photoId,albumId,"private://"+fileId,fileId,uid,name,stamp,"private://"+fileId,"r2-private-v1",albumId,isAdmin?1:0,albumId,fileId).run();
   const attached=await env.DB.prepare("SELECT id,album_id,criado_em FROM clube_fotos WHERE album_id=? AND storage_path=? AND origem_arquivo='r2-private-v1' AND COALESCE(ativo,1)=1 LIMIT 1").bind(albumId,fileId).first();
   if(!attached)return json({ok:false,error:"O álbum foi trancado antes de confirmar o envio."},409,headers);
   if(attached.id!==photoId)return json({ok:true,already_attached:true,photo_id:attached.id},200,headers);
   return json({ok:true,photo:{id:photoId,album_id:albumId,image_url:"/api/v1/club/albums/photos/"+encodeURIComponent(photoId)+"/content",created_at:stamp}},201,headers);
  }
  const clubPhotoRoute=url.pathname.match(new RegExp("^/api/v1/club/albums/photos/([^/]+)$"));
  if(clubPhotoRoute&&request.method==="DELETE"){
   const photoId=decodeURIComponent(clubPhotoRoute[1]),stamp=new Date().toISOString();
   const photo=await env.DB.prepare("SELECT f.id,f.usuario_id,a.trancado FROM clube_fotos f JOIN clube_albuns a ON a.id=f.album_id WHERE f.id=? AND COALESCE(f.ativo,1)=1 AND COALESCE(a.ativo,1)=1 LIMIT 1").bind(photoId).first();
   if(!photo)return json({ok:false,error:"Foto não encontrada."},404,headers);
   if(!isAdmin&&(String(photo.usuario_id)!==String(uid)||Number(photo.trancado)===1))return json({ok:false,error:"Você só pode remover suas fotos de álbuns destrancados."},403,headers);
   const result=await env.DB.prepare("UPDATE clube_fotos SET ativo=0 WHERE id=? AND COALESCE(ativo,1)=1 AND EXISTS(SELECT 1 FROM clube_albuns a WHERE a.id=clube_fotos.album_id AND COALESCE(a.ativo,1)=1 AND (?=1 OR (clube_fotos.usuario_id=? AND COALESCE(a.trancado,0)=0)))").bind(photoId,isAdmin?1:0,uid).run();
   if(!result.meta||result.meta.changes!==1)return json({ok:false,error:"Foto não encontrada."},404,headers);
   return json({ok:true,removed:true,id:photoId,removed_at:stamp},200,headers);
  }
  if(url.pathname==="/api/v1/club/finish-request"&&request.method==="POST"){
   const b=await readBody(request),cycle=validText(b.cycle_id,160,"Identificador do ciclo",true);
   const participant=await env.DB.prepare("SELECT id,recompensa_recebida FROM clube_livro_participantes WHERE usuario_id=? AND ciclo_id=? ORDER BY atualizado_em DESC LIMIT 1").bind(uid,cycle).first();
   if(!participant)return json({ok:false,error:"Sua participação neste ciclo não foi localizada."},404,headers);
   if(Number(participant.recompensa_recebida)===1)return json({ok:true,already_rewarded:true,participant_id:participant.id,cycle_id:cycle},200,headers);
   const existing=await env.DB.prepare("SELECT id FROM solicitacoes_validacao WHERE usuario_id=? AND lower(COALESCE(status,'pending')) IN ('pending','processing','pendente','processando') AND (lower(COALESCE(origem,'')) LIKE '%livro do clube%' OR COALESCE(json_extract(dados,'$.request_kind'),'')='club_finish' OR COALESCE(json_extract(dados,'$.tipo_validacao'),'')='club_finish') AND COALESCE(json_extract(dados,'$.cycle_id'),'')=? ORDER BY created_at DESC LIMIT 1").bind(uid,cycle).first();
   if(existing)return json({ok:true,already_pending:true,request_id:existing.id,participant_id:participant.id,cycle_id:cycle},200,headers);
   const book=await env.DB.prepare("SELECT titulo,autor,paginas_total,xp_recompensa,pontos_recompensa FROM clube_livro_atual WHERE id='atual' LIMIT 1").first();
   if(!book)return json({ok:false,error:"Livro do Clube atual não encontrado."},404,headers);
   const user=await env.DB.prepare("SELECT nome,email FROM usuarios WHERE id=? LIMIT 1").bind(uid).first(),name=String(user&&user.nome||user&&user.email&&user.email.split("@")[0]||"Membro"),id=crypto.randomUUID(),stamp=new Date().toISOString(),pages=Math.max(0,Number(book.paginas_total)||0),xp=Math.max(0,Number(book.xp_recompensa==null?25:book.xp_recompensa)||0),points=Math.max(0,Number(book.pontos_recompensa==null?10:book.pontos_recompensa)||0);
   await env.DB.prepare("INSERT INTO solicitacoes_validacao(id,usuario_id,usuario_nome,tipo,status,origem,livro,paginas,resenha,xp,pontos,dados,created_at,updated_at,criado_em,atualizado_em) VALUES(?,?,?,'finish','pending','Finalização do Livro do Clube',?,?,?, ?,?,?, ?,?,?,?)").bind(id,uid,name,String(book.titulo||"Livro do Clube"),pages,"Finalização do Livro do Clube enviada para aprovação.",xp,points,JSON.stringify({request_kind:"club_finish",tipo_validacao:"club_finish",participant_id:participant.id,clube_participante_id:participant.id,cycle_id:cycle,club_book_id:"atual",club_book_title:String(book.titulo||"Livro do Clube"),club_book_author:String(book.autor||""),v511:true}),stamp,stamp,stamp,stamp).run();
   return json({ok:true,request_id:id,participant_id:participant.id,cycle_id:cycle,status:"pending"},201,headers);
  }
  if(url.pathname==="/api/v1/admin/requests/approve-club-finish"&&request.method==="POST"){
   if(!isAdmin)return json({ok:false,error:"Acesso administrativo não confirmado."},403,headers);
   const b=await readBody(request),requestId=validText(b.request_id,128,"ID da solicitação",true),reason=validText(b.reason||"Finalização do Livro do Clube aprovada.",1000,"Motivo");
   const req=await env.DB.prepare("SELECT * FROM solicitacoes_validacao WHERE id=? LIMIT 1").bind(requestId).first();
   if(!req)return json({ok:false,error:"Solicitação não encontrada."},404,headers);
   const status=String(req.status||"pending").toLowerCase();
   if(["approved","aprovado","aprovada"].includes(status))return json({ok:true,applied:false,already_reviewed:true,status:"approved"},200,headers);
   if(["rejected","recusado","recusada"].includes(status))return json({ok:false,error:"Esta solicitação já foi recusada."},409,headers);
   const data=parseObject(req.dados),userId=String(req.usuario_id||""),cycle=String(data.cycle_id||""),requestedParticipant=String(data.participant_id||data.clube_participante_id||"");
   if(!cycle)return json({ok:false,error:"Solicitação antiga sem identificação de ciclo. Reenvie a finalização no ciclo atual."},422,headers);
   if(!userId)return json({ok:false,error:"Solicitação sem usuário associado."},422,headers);
   let participant=null;
   if(requestedParticipant)participant=await env.DB.prepare("SELECT id,usuario_id,ciclo_id,pagina_atual,recompensa_recebida FROM clube_livro_participantes WHERE id=? AND usuario_id=? AND ciclo_id=? LIMIT 1").bind(requestedParticipant,userId,cycle).first();
   if(!participant)participant=await env.DB.prepare("SELECT id,usuario_id,ciclo_id,pagina_atual,recompensa_recebida FROM clube_livro_participantes WHERE usuario_id=? AND ciclo_id=? ORDER BY atualizado_em DESC LIMIT 1").bind(userId,cycle).first();
   if(!participant)return json({ok:false,error:"A participação deste usuário neste ciclo não foi localizada."},404,headers);
   const book=await env.DB.prepare("SELECT titulo,autor,paginas_total,xp_recompensa,pontos_recompensa FROM clube_livro_atual WHERE id='atual' LIMIT 1").first();
   const target=await env.DB.prepare("SELECT id FROM usuarios WHERE id=? LIMIT 1").bind(userId).first();
   if(!target)return json({ok:false,error:"O perfil do usuário não está disponível no banco de staging."},404,headers);
   const xpRaw=book&&book.xp_recompensa!=null?book.xp_recompensa:req.xp,pointsRaw=book&&book.pontos_recompensa!=null?book.pontos_recompensa:req.pontos,totalRaw=book&&book.paginas_total!=null?book.paginas_total:req.paginas;const xp=Math.max(0,Number(xpRaw==null||xpRaw===""?25:xpRaw)||0),points=Math.max(0,Number(pointsRaw==null||pointsRaw===""?10:pointsRaw)||0),total=Math.max(0,Number(totalRaw)||0),stamp=new Date().toISOString(),claim="clubfinish:"+cycle+":"+userId;
   const batch=[
    env.DB.prepare("INSERT OR IGNORE INTO entrel_reward_claims_v510(claim_key,usuario_id,source_type,source_id,xp,pontos,applied,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(claim,userId,"club_finish",requestId,xp,points,Number(participant.recompensa_recebida)===1?1:0,stamp),
    env.DB.prepare("UPDATE usuarios SET xp=COALESCE(xp,0)+(SELECT xp FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0),pontos=COALESCE(pontos,0)+(SELECT pontos FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0),atualizado_em=? WHERE id=? AND EXISTS(SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0)").bind(claim,claim,stamp,userId,claim),
    env.DB.prepare("UPDATE entrel_reward_claims_v510 SET applied=1,applied_at=? WHERE claim_key=? AND applied=0").bind(stamp,claim),
    env.DB.prepare("UPDATE clube_livro_participantes SET finalizado=1,progresso_pct=100,pagina_atual=CASE WHEN ?>0 THEN MAX(COALESCE(pagina_atual,0),?) ELSE COALESCE(pagina_atual,0) END,recompensa_recebida=1,atualizado_em=? WHERE id=? AND usuario_id=? AND ciclo_id=?").bind(total,total,stamp,participant.id,userId,cycle),
    env.DB.prepare("UPDATE solicitacoes_validacao SET status='approved',dados=json_set(COALESCE(dados,'{}'),'$.v511_approved',json('true'),'$.v511_approved_at',?,'$.v511_cycle_id',?,'$.v511_reward_claim',?,'$.v511_admin_reason',?),resposta_admin=?,revisado_por=?,revisado_em=?,atualizado_em=? WHERE id=? AND lower(COALESCE(status,'pending')) NOT IN ('approved','aprovado','aprovada','rejected','recusado','recusada')").bind(stamp,cycle,claim,reason,reason,uid,stamp,stamp,requestId)
   ];
   await env.DB.batch(batch);
   const balances=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=?").bind(userId).first();
   const finalParticipant=await env.DB.prepare("SELECT finalizado,recompensa_recebida,progresso_pct,pagina_atual FROM clube_livro_participantes WHERE id=? AND usuario_id=? AND ciclo_id=?").bind(participant.id,userId,cycle).first();
   const finalRequest=await env.DB.prepare("SELECT status FROM solicitacoes_validacao WHERE id=?").bind(requestId).first();
   return json({ok:true,status:finalRequest&&finalRequest.status||"approved",participant_id:participant.id,cycle_id:cycle,user_id:userId,book_title:book&&book.titulo||"Livro do Clube",xp:Number(balances&&balances.xp)||0,points:Number(balances&&balances.pontos)||0,participant:finalParticipant,claim_key:claim},200,headers);
  }
  if(url.pathname==="/api/v1/admin/requests/approve-book-finish"&&request.method==="POST"){
   if(!isAdmin)return json({ok:false,error:"Acesso administrativo não confirmado."},403,headers);
   const b=await readBody(request),requestId=validText(b.request_id,128,"ID da solicitação",true),reason=validText(b.reason||"Solicitação aprovada.",1000,"Motivo");
   const req=await env.DB.prepare("SELECT * FROM solicitacoes_validacao WHERE id=? LIMIT 1").bind(requestId).first();
   if(!req)return json({ok:false,error:"Solicitação não encontrada."},404,headers);
   const status=String(req.status||"pending").toLowerCase();
   if(!/finish|finaliz/i.test(String(req.tipo||"")))return json({ok:false,error:"Esta rota aceita apenas solicitações de finalização de livro."},400,headers);
   if(["approved","aprovado","aprovada"].includes(status))return json({ok:true,applied:false,already_reviewed:true,status:"approved"},200,headers);
   if(["rejected","recusado","recusada"].includes(status))return json({ok:false,error:"Esta solicitação já foi recusada."},409,headers);
   const data=parseObject(req.dados);if(/club|clube/i.test(String(req.origem||""))||/club_finish/i.test(String(data.request_kind||"")))return json({ok:false,error:"Finalizações do Clube devem usar a rota própria."},409,headers);const userId=String(req.usuario_id||"");
   if(!userId)return json({ok:false,error:"Solicitação sem usuário associado."},422,headers);
   const ref=String(req.livro_id||data.online_livro_id||data.livro_id_online||data.livro_id||data.book_id||"");
   const title=String(req.livro||req.livro_titulo||data.livro_titulo||data.bookTitle||"").trim();
   const author=String(data.autor||data.author||"").trim();
   let book=null;
   if(ref)book=await env.DB.prepare("SELECT id,paginas,dados FROM livros_pessoais WHERE usuario_id=? AND (id=? OR livro_id=?) ORDER BY atualizado_em DESC LIMIT 1").bind(userId,ref,ref).first();
   if(!book&&title)book=await env.DB.prepare("SELECT id,paginas,dados FROM livros_pessoais WHERE usuario_id=? AND lower(trim(titulo))=lower(?) AND (?='' OR lower(trim(COALESCE(autor,'')))=lower(?)) ORDER BY atualizado_em DESC LIMIT 1").bind(userId,title,author,author).first();
   if(!book&&title)book=await env.DB.prepare("SELECT id,paginas,dados FROM livros_pessoais WHERE usuario_id=? AND lower(trim(titulo))=lower(?) ORDER BY atualizado_em DESC LIMIT 1").bind(userId,title).first();
   if(!book)return json({ok:false,error:"O livro não foi localizado na biblioteca online do usuário."},404,headers);
   const targetUser=await env.DB.prepare("SELECT id FROM usuarios WHERE id=? LIMIT 1").bind(userId).first();if(!targetUser)return json({ok:false,error:"O perfil do usuário não está disponível no banco de staging."},404,headers);
   const total=Math.max(1,Number(book.paginas)||Number(req.paginas)||Number(data.paginas)||1),xp=Math.max(0,Number(req.xp??data.xp??data.rewardXp??0)||0),points=Math.max(0,Number(req.pontos??data.pontos??data.rewardPoints??10)||0),stamp=new Date().toISOString(),claim="bookfinish:"+userId+":"+book.id;
   const oldBookData=parseObject(book.dados);const newBookData=JSON.stringify({...oldBookData,finishPending:false,finished:true,finalizado:true,finishedAt:oldBookData.finishedAt||stamp,finishApprovedAt:stamp,finishRequestId:requestId,finishRewardClaim:claim,v510:true});
   const batch=[
    env.DB.prepare("INSERT OR IGNORE INTO entrel_reward_claims_v510(claim_key,usuario_id,source_type,source_id,xp,pontos,applied,created_at) VALUES(?,?,?,?,?,?,0,?)").bind(claim,userId,"book_finish",requestId,xp,points,stamp),
    env.DB.prepare("UPDATE usuarios SET xp=COALESCE(xp,0)+(SELECT xp FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0),pontos=COALESCE(pontos,0)+(SELECT pontos FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0),atualizado_em=? WHERE id=? AND EXISTS(SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0)").bind(claim,claim,stamp,userId,claim),
    env.DB.prepare("UPDATE entrel_reward_claims_v510 SET applied=1,applied_at=? WHERE claim_key=? AND applied=0").bind(stamp,claim),
    env.DB.prepare("UPDATE livros_pessoais SET pagina_atual=?,progresso=100,status='finished',ativo=1,dados=?,atualizado_em=?,finalizado_em=? WHERE id=? AND usuario_id=?").bind(total,newBookData,stamp,stamp,book.id,userId),
    env.DB.prepare("INSERT INTO leituras(id,usuario_id,livro_id,pagina_atual,porcentagem,progresso,finalizado,status,dados,atualizado_em) VALUES(?,?,?,?,100,100,1,'finished',?,?) ON CONFLICT(usuario_id,livro_id) DO UPDATE SET pagina_atual=excluded.pagina_atual,porcentagem=100,progresso=100,finalizado=1,status='finished',dados=excluded.dados,atualizado_em=excluded.atualizado_em").bind(crypto.randomUUID(),userId,book.id,total,JSON.stringify({v510:true,requestId}),stamp),
    env.DB.prepare("UPDATE solicitacoes_validacao SET status='approved',dados=json_set(COALESCE(dados,'{}'),'$.v510_approved',json('true'),'$.v510_approved_at',?,'$.v510_type','finish','$.v510_reward_claim',?,'$.v510_resolved_book_id',?,'$.v510_admin_reason',?),resposta_admin=?,revisado_por=?,revisado_em=?,atualizado_em=? WHERE id=? AND lower(COALESCE(status,'pending')) NOT IN ('approved','aprovado','aprovada','rejected','recusado','recusada')").bind(stamp,claim,book.id,reason,reason,uid,stamp,stamp,requestId)
   ];
   await env.DB.batch(batch);
   const balances=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=?").bind(userId).first();
   return json({ok:true,status:"approved",book_id:book.id,user_id:userId,xp:Number(balances&&balances.xp)||0,points:Number(balances&&balances.pontos)||0,claim_key:claim},200,headers);
  }

  // Notificações: leitura e estado individual; nenhuma escrita dispara push.
  if(request.method==="GET"&&url.pathname==="/api/v1/notifications"){
   const limit=clampInt(url.searchParams.get("limit"),50,1,100);
   const before=url.searchParams.get("before"),beforeId=url.searchParams.get("before_id");
   if(!!before!==!!beforeId)return json({ok:false,error:"Use before e before_id juntos."},400,headers);
   const rows=await env.DB.prepare(`SELECT id,usuario_id,target_id,titulo,mensagem,tipo,lida,lida_por,ocultada_por,origem,dados,criada_em,atualizado_em
    FROM app_notificacoes
    WHERE (usuario_id=? OR target_id=? OR (usuario_id='all' AND target_id='all'))
      AND NOT EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(ocultada_por) THEN ocultada_por ELSE '[]' END) WHERE value=?)
      AND (? IS NULL OR criada_em<? OR (criada_em=? AND id<?))
    ORDER BY criada_em DESC,id DESC LIMIT ?`).bind(uid,uid,uid,before,before,before,beforeId,limit).all();
   const items=(rows.results||[]).map(n=>{
    let readBy=[],hiddenBy=[],data={};
    try{readBy=JSON.parse(n.lida_por||"[]");if(!Array.isArray(readBy))readBy=[];}catch(_){}
    try{hiddenBy=JSON.parse(n.ocultada_por||"[]");if(!Array.isArray(hiddenBy))hiddenBy=[];}catch(_){}
    try{data=JSON.parse(n.dados||"{}");if(!data||typeof data!=="object"||Array.isArray(data))data={};}catch(_){}
    const personal=n.usuario_id===uid||n.target_id===uid;
    return {...n,dados:data,lida:personal?(n.lida===1||n.lida===true):((n.lida===1||n.lida===true)||readBy.includes(uid)),ocultada_por:undefined,lida_por:undefined};
   });
   const last=items[items.length-1];
   return json({ok:true,items,count:items.length,nextCursor:items.length===limit&&last?{before:last.criada_em,before_id:last.id}:null},200,headers);
  }
  const notificationAction=url.pathname.match(/^\/api\/v1\/notifications\/([^/]+)\/(read|hide)$/);
  if(request.method==="POST"&&notificationAction){
   const notificationId=decodeURIComponent(notificationAction[1]),action=notificationAction[2];
   const row=await env.DB.prepare("SELECT id,usuario_id,target_id,lida,lida_por,ocultada_por FROM app_notificacoes WHERE id=? AND (usuario_id=? OR target_id=? OR (usuario_id='all' AND target_id='all')) LIMIT 1").bind(notificationId,uid,uid).first();
   if(!row)return json({ok:false,error:"Notificação não encontrada."},404,headers);
   const stamp=new Date().toISOString();
   if(action==="read"){
    if(row.usuario_id===uid||row.target_id===uid){
     await env.DB.prepare("UPDATE app_notificacoes SET lida=1,atualizado_em=? WHERE id=? AND (usuario_id=? OR target_id=?)").bind(stamp,notificationId,uid,uid).run();
    }else{
     await env.DB.prepare("UPDATE app_notificacoes SET lida_por=CASE WHEN EXISTS(SELECT 1 FROM json_each(CASE WHEN json_valid(lida_por) THEN lida_por ELSE '[]' END) WHERE value=?) THEN lida_por ELSE json_insert(CASE WHEN json_valid(lida_por) THEN lida_por ELSE '[]' END,'$[#]',?) END,atualizado_em=? WHERE id=?").bind(uid,uid,stamp,notificationId).run();
    }
   }else{
    await env.DB.prepare("UPDATE app_notificacoes SET ocultada_por=CASE WHEN EXISTS(SELECT 1 FROM json_each(CASE WHEN json_valid(ocultada_por) THEN ocultada_por ELSE '[]' END) WHERE value=?) THEN ocultada_por ELSE json_insert(CASE WHEN json_valid(ocultada_por) THEN ocultada_por ELSE '[]' END,'$[#]',?) END,atualizado_em=? WHERE id=?").bind(uid,uid,stamp,notificationId).run();
   }
   return json({ok:true,id:notificationId,action:action},200,headers);
  }
  if(request.method==="POST"&&url.pathname==="/api/v1/library/books"){const b=await readBody(request),title=validText(b.title,240,"Título",true),author=validText(b.author,200,"Autor",true),genre=validText(b.genre||"Outro",100,"Gênero"),pages=clampInt(b.pages,100,1,100000);if(b.current_page!==undefined&&(!Number.isInteger(Number(b.current_page))||Number(b.current_page)<0||Number(b.current_page)>pages))return json({ok:false,error:"A página atual precisa estar entre 0 e o total de páginas."},400,headers);const currentPage=clampInt(b.current_page,0,0,pages),cover=validText(b.cover_url||"",2048,"Capa"),cfi=validText(b.epub_cfi||"",4096,"Posição EPUB"),requestedStatus=String(b.status||"reading").toLowerCase(),status=["reading","pending_finish","finished"].includes(requestedStatus)?requestedStatus:"reading",progress=Math.max(0,Math.min(100,Math.round(currentPage/pages*100))),finished=status==="finished"||currentPage>=pages,finalStatus=finished?"finished":status;if(cover&&!/^https:/i.test(cover))return json({ok:false,error:"A capa precisa ser uma URL HTTPS."},400,headers);const all=await env.DB.prepare("SELECT id,titulo,autor FROM livros_pessoais WHERE usuario_id=? AND COALESCE(ativo,1)=1 LIMIT 500").bind(uid).all();const dup=(all.results||[]).find(x=>clean(x.titulo)===clean(title)&&clean(x.autor)===clean(author));if(dup)return json({ok:false,error:"Este livro já está na sua biblioteca.",existing_book_id:dup.id},409,headers);const id=crypto.randomUUID(),stamp=new Date().toISOString(),dados=JSON.stringify({source:"personal-manual-online",finishPending:finalStatus==="pending_finish",createdFrom:"manual",schemaVersion:1});await env.DB.prepare("INSERT INTO livros_pessoais (id,usuario_id,livro_id,titulo,autor,genero,paginas,capa,capa_url,epub_storage_path,pagina_atual,progresso,epub_cfi,status,ativo,dados,publico,criado_em,atualizado_em,finalizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,uid,id,title,author,genre,pages,cover,cover,"",currentPage,progress,cfi,finalStatus,1,dados,0,stamp,stamp,finished?stamp:null).run();const book=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? LIMIT 1").bind(id,uid).first();return json({ok:true,book},201,headers);}
  const route=url.pathname.match(/^\/api\/v1\/library\/books\/([^/]+)$/);if(route&&request.method==="GET"){const id=decodeURIComponent(route[1]),book=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? AND COALESCE(ativo,1)=1 LIMIT 1").bind(id,uid).first();if(!book)return json({ok:false,error:"Livro não encontrado."},404,headers);return json({ok:true,book},200,headers);}if(route&&(request.method==="PATCH"||request.method==="DELETE")){const id=decodeURIComponent(route[1]),book=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? LIMIT 1").bind(id,uid).first();if(!book)return json({ok:false,error:"Livro não encontrado."},404,headers);if(request.method==="DELETE"){const stamp=new Date().toISOString();await env.DB.prepare("UPDATE livros_pessoais SET ativo=0,atualizado_em=? WHERE id=? AND usuario_id=?").bind(stamp,id,uid).run();return json({ok:true,removed:true,book_id:id},200,headers);}const b=await readBody(request),title=b.title===undefined?book.titulo:validText(b.title,240,"Título",true),author=b.author===undefined?book.autor:validText(b.author,200,"Autor",true),genre=b.genre===undefined?book.genero:validText(b.genre,100,"Gênero"),pages=b.pages===undefined?(Number(book.paginas)||100):clampInt(b.pages,Number(book.paginas)||100,1,100000);if(b.current_page!==undefined&&(!Number.isInteger(Number(b.current_page))||Number(b.current_page)<0||Number(b.current_page)>pages))return json({ok:false,error:"A página atual precisa estar entre 0 e o total de páginas."},400,headers);if(b.pages!==undefined&&Number(book.pagina_atual)>pages&&b.current_page===undefined)return json({ok:false,error:"O total de páginas não pode ficar abaixo da página de leitura atual."},409,headers);const cover=b.cover_url===undefined?(book.capa_url||""):validText(b.cover_url,2048,"Capa"),page=b.current_page===undefined?clampInt(book.pagina_atual,0,0,pages):clampInt(b.current_page,0,0,pages),cfi=b.epub_cfi===undefined?String(book.epub_cfi||""):validText(b.epub_cfi,4096,"Posição EPUB"),rawStatus=b.status===undefined?String(book.status||"reading"):String(b.status).toLowerCase();if(!["reading","pending_finish","finished"].includes(rawStatus))return json({ok:false,error:"Status de leitura inválido."},400,headers);if(cover&&!/^https:/i.test(cover))return json({ok:false,error:"A capa precisa ser uma URL HTTPS."},400,headers);const progress=Math.max(0,Math.min(100,Math.round(page/pages*100))),status=page>=pages?"finished":rawStatus,finished=status==="finished",stamp=new Date().toISOString(),dados=JSON.stringify(Object.assign({},parseObject(book.dados),{finishPending:status==="pending_finish"})),bookKey=String(book.livro_id||book.id),rid=crypto.randomUUID();await env.DB.batch([env.DB.prepare("UPDATE livros_pessoais SET titulo=?,autor=?,genero=?,paginas=?,capa=?,capa_url=?,pagina_atual=?,progresso=?,epub_cfi=?,status=?,finalizado_em=CASE WHEN ?=1 THEN COALESCE(finalizado_em,?) ELSE NULL END,dados=?,atualizado_em=? WHERE id=? AND usuario_id=?").bind(title,author,genre,pages,cover,cover,page,progress,cfi,status,finished?1:0,stamp,dados,stamp,id,uid),env.DB.prepare("INSERT INTO leituras (id,usuario_id,livro_id,pagina_atual,porcentagem,finalizado,atualizado_em,progresso,epub_cfi,status,dados) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(usuario_id,livro_id) DO UPDATE SET pagina_atual=excluded.pagina_atual,porcentagem=excluded.porcentagem,finalizado=excluded.finalizado,atualizado_em=excluded.atualizado_em,progresso=excluded.progresso,epub_cfi=excluded.epub_cfi,status=excluded.status,dados=excluded.dados").bind(rid,uid,bookKey,page,progress,finished?1:0,stamp,progress,cfi,status,dados)]);const updated=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? LIMIT 1").bind(id,uid).first();return json({ok:true,book:updated},200,headers);}
  if(request.method==="POST"&&url.pathname==="/api/v1/reading"){const b=await readBody(request),bookId=validText(b.book_id,128,"Identificador do livro",true),book=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? AND COALESCE(ativo,1)=1 LIMIT 1").bind(bookId,uid).first();if(!book)return json({ok:false,error:"Livro ativo não encontrado na sua biblioteca."},404,headers);const pages=Math.max(1,Number(book.paginas)||1),page=clampInt(b.current_page,Number(book.pagina_atual)||0,0,pages);if(b.current_page!==undefined&&(!Number.isInteger(Number(b.current_page))||Number(b.current_page)<0||Number(b.current_page)>pages))return json({ok:false,error:"A página atual precisa estar entre 0 e o total de páginas."},400,headers);const progress=Math.max(0,Math.min(100,Math.round(page/pages*100))),stamp=new Date().toISOString(),old=String(book.status||"reading"),status=/pending_finish|aguardando/i.test(old)?"pending_finish":(/finished|finalizado|concluido|concluído/i.test(old)||page>=pages?"finished":"reading"),cfi=validText(b.epub_cfi===undefined?book.epub_cfi:b.epub_cfi,4096,"Posição EPUB"),dados=JSON.stringify(Object.assign({},parseObject(book.dados),{lastProgressSource:"reader",lastProgressAt:stamp,lastReadAt:stamp})),finished=status==="finished"?1:0,readId=crypto.randomUUID();await env.DB.batch([env.DB.prepare("UPDATE livros_pessoais SET pagina_atual=?,progresso=?,epub_cfi=?,status=?,finalizado_em=CASE WHEN ?=1 THEN COALESCE(finalizado_em,?) ELSE finalizado_em END,dados=?,atualizado_em=? WHERE id=? AND usuario_id=? AND COALESCE(ativo,1)=1").bind(page,progress,cfi,status,finished,stamp,dados,stamp,bookId,uid),env.DB.prepare("INSERT INTO leituras (id,usuario_id,livro_id,pagina_atual,porcentagem,finalizado,atualizado_em,progresso,epub_cfi,status,dados) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(usuario_id,livro_id) DO UPDATE SET pagina_atual=excluded.pagina_atual,porcentagem=excluded.porcentagem,finalizado=excluded.finalizado,atualizado_em=excluded.atualizado_em,progresso=excluded.progresso,epub_cfi=excluded.epub_cfi,status=excluded.status,dados=excluded.dados").bind(readId,uid,String(book.livro_id||book.id),page,progress,finished,stamp,progress,cfi,status,dados)]);const updated=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? LIMIT 1").bind(bookId,uid).first(),reading=await env.DB.prepare("SELECT * FROM leituras WHERE usuario_id=? AND livro_id=? LIMIT 1").bind(uid,String(book.livro_id||book.id)).first();return json({ok:true,book:updated,reading},200,headers);}
  
  // Reparo administrativo dos participantes do clube: preserva registros e só corrige campos derivados.
  if(url.pathname==="/api/v1/admin/club/repair-participants"&&request.method==="POST"){
   if(!isAdmin)return json({ok:false,error:"Acesso administrativo não confirmado."},403,headers);
   const names=await env.DB.prepare("UPDATE clube_livro_participantes AS p SET usuario_nome=COALESCE(NULLIF(TRIM(u.nome),''),NULLIF(CASE WHEN instr(COALESCE(u.email,''),'@')>1 THEN substr(u.email,1,instr(u.email,'@')-1) ELSE u.email END,''),'Membro') FROM usuarios AS u WHERE p.usuario_id=u.id AND (p.usuario_nome IS NULL OR TRIM(p.usuario_nome)='' OR p.usuario_nome=p.usuario_id)").run();
   const sync=await env.DB.prepare("UPDATE clube_livro_participantes AS p SET finalizado=1,progresso_pct=100,recompensa_recebida=1,atualizado_em=? WHERE EXISTS (SELECT 1 FROM entrel_reward_claims_v510 c WHERE c.usuario_id=p.usuario_id AND c.applied=1 AND (c.claim_key='clubfinish:'||p.id OR c.claim_key='clubfinish:'||p.ciclo_id||':'||p.usuario_id)) AND COALESCE(p.recompensa_recebida,0)=0").bind(new Date().toISOString()).run();
   const orphan=await env.DB.prepare("SELECT COUNT(*) AS total FROM clube_livro_participantes p LEFT JOIN usuarios u ON u.id=p.usuario_id WHERE p.livro_id='atual' AND u.id IS NULL").first();
   return json({ok:true,names_repaired:Number(names.meta&&names.meta.changes)||0,claims_synced:Number(sync.meta&&sync.meta.changes)||0,orphan_participants:Number(orphan&&orphan.total)||0},200,headers);
  }

  // Reprocessa somente claims pendentes, com carimbo único por claim para impedir XP duplicado.
  if(url.pathname==="/api/v1/rewards/retry-pending"&&request.method==="POST"){
   const body=await readBody(request),target=validText(body.user_id||"",128,"Usuário"),all=isAdmin&&!target,userId=target||uid;
   if(!isAdmin&&userId!==uid)return json({ok:false,error:"Sem permissão para reprocessar outra conta."},403,headers);
   const q=await env.DB.prepare("SELECT claim_key,usuario_id,xp,pontos FROM entrel_reward_claims_v510 WHERE applied=0 AND (?=1 OR usuario_id=?) ORDER BY created_at ASC LIMIT 30").bind(all?1:0,userId).all();
   let applied=0,pending=0;
   for(let i=0;i<(q.results||[]).length;i++){
    const c=q.results[i],stamp=new Date(Date.now()+i).toISOString();
    const exists=await env.DB.prepare("SELECT id FROM usuarios WHERE id=? LIMIT 1").bind(c.usuario_id).first();
    if(!exists){pending++;continue;}
    const results=await env.DB.batch([
     env.DB.prepare("UPDATE entrel_reward_claims_v510 SET applied=1,applied_at=? WHERE claim_key=? AND applied=0").bind(stamp,c.claim_key),
     env.DB.prepare("UPDATE usuarios SET xp=COALESCE(xp,0)+?,pontos=COALESCE(pontos,0)+?,atualizado_em=? WHERE id=? AND EXISTS (SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=1 AND applied_at=?)").bind(Math.max(0,Number(c.xp)||0),Math.max(0,Number(c.pontos)||0),stamp,c.usuario_id,c.claim_key,stamp)
    ]);
    if(Number(results[0]&&results[0].meta&&results[0].meta.changes)>0)applied++;else pending++;
   }
   return json({ok:true,applied_or_done:applied,still_pending:pending,user_id:all?null:userId},200,headers);
  }

  // Conclusão administrativa do Clube v507/v511, com claim idempotente e sem remover recompensas já pagas.
  if(url.pathname==="/api/v1/admin/club/finish-participant"&&request.method==="POST"){
   if(!isAdmin)return json({ok:false,error:"Acesso administrativo não confirmado."},403,headers);
   const b=await readBody(request),ref=validText(b.ref||b.participant_id,128,"Participante",true),cycle=validText(b.cycle_id||"",160,"Ciclo"),target=validText(b.user_id||"",128,"Usuário");
   let part=null;
   if(cycle)part=await env.DB.prepare("SELECT * FROM clube_livro_participantes WHERE id=? AND ciclo_id=? LIMIT 1").bind(ref,cycle).first();
   if(!part&&cycle)part=await env.DB.prepare("SELECT * FROM clube_livro_participantes WHERE usuario_id=? AND ciclo_id=? ORDER BY atualizado_em DESC LIMIT 1").bind(ref,cycle).first();
   if(!part&&!cycle)part=await env.DB.prepare("SELECT * FROM clube_livro_participantes WHERE id=? LIMIT 1").bind(ref).first();
   if(!part&&!cycle)part=await env.DB.prepare("SELECT * FROM clube_livro_participantes WHERE usuario_id=? ORDER BY atualizado_em DESC LIMIT 1").bind(ref).first();
   if(!part&&target)part=await env.DB.prepare("SELECT * FROM clube_livro_participantes WHERE id=? AND usuario_id=? LIMIT 1").bind(ref,target).first();
   if(!part)return json({ok:false,reason:"participant_not_found",message:"Participação deste ciclo não encontrada."},200,headers);
   const participantId=String(part.id),userId=String(part.usuario_id),cycleId=String(part.ciclo_id||cycle||participantId);
   if(Number(part.finalizado)===1||part.finalizado===true){
    const stamp=new Date().toISOString();
    await env.DB.prepare("UPDATE clube_livro_participantes SET finalizado=0,progresso_pct=MIN(99,COALESCE(progresso_pct,99)),pagina_atual=MAX(0,COALESCE(pagina_atual,0)-1),atualizado_em=? WHERE id=? AND usuario_id=?").bind(stamp,participantId,userId).run();
    const bal=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=? LIMIT 1").bind(userId).first();
    return json({ok:true,undone:true,already_rewarded:true,participant_id:participantId,user_id:userId,cycle_id:cycleId,xp_added:0,points_added:0,xp:Number(bal&&bal.xp)||0,points:Number(bal&&bal.pontos)||0},200,headers);
   }
   const book=await env.DB.prepare("SELECT titulo,autor,paginas_total,xp_recompensa,pontos_recompensa FROM clube_livro_atual WHERE id='atual' LIMIT 1").first();
   if(!book)return json({ok:false,reason:"book_not_found",message:"Livro do Clube atual não encontrado."},200,headers);
   const user=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=? LIMIT 1").bind(userId).first();
   if(!user)return json({ok:false,error:"Usuária não encontrada."},404,headers);
   const claimKey="clubfinish:"+cycleId+":"+userId,stamp=new Date().toISOString(),xp=Math.max(0,Number(book.xp_recompensa==null?25:book.xp_recompensa)||0),points=Math.max(0,Number(book.pontos_recompensa==null?10:book.pontos_recompensa)||0),pages=Math.max(0,Number(book.paginas_total)||0);
   const claim=await env.DB.prepare("SELECT applied FROM entrel_reward_claims_v510 WHERE claim_key=? LIMIT 1").bind(claimKey).first();
   const already=Number(part.recompensa_recebida)===1||part.recompensa_recebida===true||Number(claim&&claim.applied)===1;
   let added=false;
   const stmts=[];
   if(!already){
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO entrel_reward_claims_v510(claim_key,usuario_id,source_type,source_id,xp,pontos,applied,created_at) VALUES(?,?,?,?,?,?,0,?)").bind(claimKey,userId,"club_admin_finish",participantId,xp,points,stamp));
    stmts.push(env.DB.prepare("UPDATE entrel_reward_claims_v510 SET created_at=? WHERE claim_key=? AND applied=0").bind(stamp,claimKey));
    stmts.push(env.DB.prepare("UPDATE usuarios SET xp=COALESCE(xp,0)+?,pontos=COALESCE(pontos,0)+?,atualizado_em=? WHERE id=? AND EXISTS(SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0 AND created_at=?)").bind(xp,points,stamp,userId,claimKey,stamp));
    stmts.push(env.DB.prepare("UPDATE entrel_reward_claims_v510 SET applied=1,applied_at=? WHERE claim_key=? AND applied=0 AND created_at=?").bind(stamp,claimKey,stamp));
   }
   stmts.push(env.DB.prepare("UPDATE clube_livro_participantes SET finalizado=1,progresso_pct=100,pagina_atual=CASE WHEN ?>0 THEN MAX(COALESCE(pagina_atual,0),?) ELSE COALESCE(pagina_atual,0) END,recompensa_recebida=1,atualizado_em=? WHERE id=? AND usuario_id=?").bind(pages,pages,stamp,participantId,userId));
   const batch=await env.DB.batch(stmts);
   if(!already)added=Number(batch[2]&&batch[2].meta&&batch[2].meta.changes)>0;
   const bal=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=? LIMIT 1").bind(userId).first();
   return json({ok:true,applied:added,already_rewarded:already||!added,participant_id:participantId,user_id:userId,cycle_id:cycleId,book_title:String(book.titulo||"Livro do Clube"),book_author:String(book.autor||""),xp_added:added?xp:0,points_added:added?points:0,xp:Number(bal&&bal.xp)||0,points:Number(bal&&bal.pontos)||0},200,headers);
  }

  
  // Recompensa de solicitação v507: claim por solicitação/período e aplicação idempotente.
  if(url.pathname==="/api/v1/admin/requests/apply-reward"&&request.method==="POST"){
   if(!isAdmin)return json({ok:false,error:"Acesso administrativo não confirmado."},403,headers);
   const b=await readBody(request),requestId=validText(b.request_id,128,"Solicitação",true),userId=validText(b.user_id,128,"Usuário",true);
   const req=await env.DB.prepare("SELECT id,usuario_id,tipo,origem,created_at,dados FROM solicitacoes_validacao WHERE id=? AND usuario_id=? LIMIT 1").bind(requestId,userId).first();
   if(!req)return json({ok:false,error:"Solicitação não encontrada."},404,headers);
   const data=parseObject(req.dados),alreadyFlag=["v510_reward_applied","v507_reward_applied","v506_reward_applied","v491_reward_applied","v488_reward_applied"].some(k=>String(data[k]).toLowerCase()==="true");
   const xp=Math.max(0,Math.floor(Number(b.xp)||0)),points=Math.max(0,Math.floor(Number(b.points)||0)),stamp=new Date().toISOString();
   const rawKind=String(req.tipo||"")+"|"+String(req.origem||"")+"|"+String(data.request_kind||"")+"|"+String(data.tipo_validacao||"");
   const lower=rawKind.toLowerCase(),kind=/(seman|weekly)/.test(lower)?"weekly":/(mensal|monthly)/.test(lower)?"monthly":"";
   const localDate=new Date(new Date(req.created_at||stamp).getTime()-4*3600000).toISOString().slice(0,10);
   let claimKey="request:"+requestId,startUtc=null,endUtc=null;
   if(kind==="weekly"){
    const d=new Date(localDate+"T00:00:00Z"),dow=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-dow);
    const monday=d.toISOString().slice(0,10);claimKey="period:"+userId+":weekly:"+monday;
    startUtc=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),4)).toISOString();
    endUtc=new Date(Date.parse(startUtc)+7*86400000).toISOString();
   }else if(kind==="monthly"){
    const month=localDate.slice(0,7),d=new Date(month+"-01T00:00:00Z");claimKey="period:"+userId+":monthly:"+month;
    startUtc=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1,4)).toISOString();
    endUtc=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1,4)).toISOString();
   }
   if(alreadyFlag){
    await env.DB.prepare("INSERT OR IGNORE INTO entrel_reward_claims_v510(claim_key,usuario_id,source_type,source_id,xp,pontos,applied,created_at,applied_at) VALUES(?,?,?,?,0,0,1,?,?)").bind("request:"+requestId,userId,"request",requestId,stamp,stamp).run();
    return json({ok:true,applied:false,already_rewarded:true,reward_pending:false,xp_added:0,points_added:0,claim_key:"request:"+requestId},200,headers);
   }
   if(kind&&startUtc&&endUtc){
    const auto=await env.DB.prepare("SELECT id FROM solicitacoes_validacao WHERE usuario_id=? AND id<>? AND created_at>=? AND created_at<? AND (origem LIKE ? OR origem LIKE ? OR origem LIKE ?) AND (lower(COALESCE(json_extract(dados,'$.v507_reward_applied'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v506_reward_applied'),'false')) IN ('true','1') OR lower(COALESCE(json_extract(dados,'$.v510_reward_applied'),'false')) IN ('true','1')) LIMIT 1").bind(userId,requestId,startUtc,endUtc,"auto_reward_v507:"+kind+":%","auto_reward_v506:"+kind+":%","auto_reward_v510:"+kind+":%").first();
    if(auto){
     await env.DB.prepare("INSERT OR IGNORE INTO entrel_reward_claims_v510(claim_key,usuario_id,source_type,source_id,xp,pontos,applied,created_at,applied_at) VALUES(?,?,?,?,?,?,1,?,?)").bind(claimKey,userId,kind,requestId,xp,points,stamp,stamp).run();
     await env.DB.prepare("UPDATE solicitacoes_validacao SET dados=json_set(COALESCE(dados,'{}'),'$.v510_reward_applied',json('true'),'$.v510_reward_pending',json('false'),'$.v510_reward_claim',?,'$.v510_reward_xp',0,'$.v510_reward_points',0),atualizado_em=? WHERE id=?").bind(claimKey,stamp,requestId).run();
     return json({ok:true,applied:false,already_rewarded:true,reward_pending:false,xp_added:0,points_added:0,claim_key:claimKey},200,headers);
    }
   }
   const user=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=? LIMIT 1").bind(userId).first();
   if(!user)return json({ok:false,error:"Usuária não encontrada."},404,headers);
   const results=await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO entrel_reward_claims_v510(claim_key,usuario_id,source_type,source_id,xp,pontos,applied,created_at) VALUES(?,?,?,?,?,?,0,?)").bind(claimKey,userId,kind||"request",requestId,xp,points,stamp),
    env.DB.prepare("UPDATE entrel_reward_claims_v510 SET created_at=? WHERE claim_key=? AND applied=0").bind(stamp,claimKey),
    env.DB.prepare("UPDATE usuarios SET xp=COALESCE(xp,0)+?,pontos=COALESCE(pontos,0)+?,atualizado_em=? WHERE id=? AND EXISTS(SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0 AND created_at=?)").bind(xp,points,stamp,userId,claimKey,stamp),
    env.DB.prepare("UPDATE entrel_reward_claims_v510 SET applied=1,applied_at=? WHERE claim_key=? AND applied=0 AND created_at=?").bind(stamp,claimKey,stamp),
    env.DB.prepare("UPDATE solicitacoes_validacao SET dados=json_set(COALESCE(dados,'{}'),'$.v510_reward_applied',json('true'),'$.v510_reward_pending',json('false'),'$.v510_reward_applied_at',?,'$.v510_reward_claim',?,'$.v510_reward_xp',?,'$.v510_reward_points',?),atualizado_em=? WHERE id=?").bind(stamp,claimKey,xp,points,stamp,requestId)
   ]);
   const added=Number(results[2]&&results[2].meta&&results[2].meta.changes)>0;
   const bal=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=? LIMIT 1").bind(userId).first();
   return json({ok:true,applied:added,already_rewarded:!added,reward_pending:false,xp_added:added?xp:0,points_added:added?points:0,xp:Number(bal&&bal.xp)||0,points:Number(bal&&bal.pontos)||0,claim_key:claimKey},200,headers);
  }

  return json({ok:false,error:"Rota não encontrada ou método não permitido."},404,headers);
 }catch(error){const message=String(error&&error.message||error),bad=/obrigatório|excede|muito grande|inválido|limite|URL HTTPS/i.test(message);return json({ok:false,error:bad?message:"Falha ao processar a operação de staging."},bad?400:500,headers);}
}};
