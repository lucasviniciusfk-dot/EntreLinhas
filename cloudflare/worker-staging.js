/* Snapshot revisado do Worker entrelinhas-api-staging.
 * Patch: erros de consulta D1 durante a resolução do perfil retornam 503 controlado.
 * Deploy deve preservar os bindings e settings atuais.
 */
const cors = (origin) => {
  const allowed = new Set(["https://lucasviniciusfk-dot.github.io","http://localhost:3000","http://localhost:5173"]);
  const headers = new Headers({"Vary":"Origin","Access-Control-Allow-Methods":"GET, POST, PATCH, DELETE, OPTIONS","Access-Control-Allow-Headers":"Authorization, Content-Type","Access-Control-Max-Age":"86400"});
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
 const url=new URL(request.url);if(url.pathname==="/health"&&request.method==="GET"){let d1=false;try{const x=await env.DB.prepare("SELECT 1 AS ok").first();d1=!!x&&x.ok===1;}catch(_){}const authReady=!!env.SUPABASE_URL&&!!env.SUPABASE_PUBLISHABLE_KEY;return json({ok:d1&&!!env.FILES&&authReady,environment:"staging",service:"entrelinhas-api-staging",bindings:{d1,r2:!!env.FILES,authConfig:authReady},readRoutesEnabled:true,writeRoutesEnabled:true},200,headers);}
 if(url.pathname==="/__staging-file-check"&&request.method==="GET"){
  const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Entre Linhas — teste de arquivos</title><style>body{font:16px system-ui;background:#111;color:#eee;max-width:560px;margin:32px auto;padding:20px}main{background:#1d1d1d;padding:22px;border-radius:16px}label{display:block;margin:14px 0 6px}input,button{box-sizing:border-box;width:100%;padding:13px;border-radius:8px;border:1px solid #555;font:inherit}input{background:#090909;color:#fff}button{margin-top:18px;background:#e8e8e8;color:#111;font-weight:700}button:disabled{opacity:.5}#out{white-space:pre-wrap;overflow-wrap:anywhere;background:#090909;padding:12px;border-radius:8px;margin-top:16px}.note{color:#bbb;font-size:14px}</style><main><h2>Teste privado de arquivos — staging</h2><p>Esta página valida upload, download, integridade e exclusão de um PNG sintético no ambiente de testes.</p><p class="note">A senha é enviada diretamente do navegador ao Supabase Auth. Ela não é enviada ao Worker nem armazenada nesta página. Não compartilhe sua senha ou token no chat.</p><form id="f"><label for="email">E-mail da sua conta</label><input id="email" type="email" autocomplete="username" required><label for="password">Senha</label><input id="password" type="password" autocomplete="current-password" required><button id="go">Entrar e executar teste</button></form><pre id="out">Aguardando autenticação.</pre></main><script>
const SUPABASE_URL="https://jxzcuqwlnqxnhftffbjx.supabase.co";
const SUPABASE_KEY="sb_publishable_LyHzFw6vbzqAPXlLPPPFYA_pQMNyqQc";
const API=location.origin;
const out=document.getElementById("out"),btn=document.getElementById("go");
function log(s){out.textContent+= "\\n"+s;}
document.getElementById("f").addEventListener("submit",async function(ev){
 ev.preventDefault();btn.disabled=true;out.textContent="Autenticando diretamente com Supabase Auth…";
 let token=null,fileId=null,deleted=false;
 try{
  const email=document.getElementById("email").value.trim(),pass=document.getElementById("password");
  const auth=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:email,password:pass.value})});
  pass.value="";
  const session=await auth.json();
  if(!auth.ok||!session.access_token)throw new Error("Falha no login: "+(session.msg||session.message||session.error_description||session.error||auth.status));
  token=session.access_token;log("Autenticação Supabase: OK. Senha limpa do formulário.");
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
  const check=await fetch(API+"/api/v1/files/"+encodeURIComponent(fileId),{headers:{Authorization:"Bearer "+token}});
  if(check.status!==404)throw new Error("Verificação pós-exclusão inesperada: HTTP "+check.status);
  log("Verificação pós-exclusão: HTTP 404, arquivo não acessível.");
  out.textContent="SUCESSO — teste completo.\\n"+out.textContent;
 }catch(e){log("FALHA: "+e.message);if(fileId&&!deleted){try{const clean=await fetch(API+"/api/v1/files/"+encodeURIComponent(fileId),{method:"DELETE",headers:{Authorization:"Bearer "+token}});if(clean.ok){deleted=true;log("Limpeza automática do arquivo temporário: OK.");}else log("ATENÇÃO: limpeza automática não confirmada (HTTP "+clean.status+").");}catch(_){log("ATENÇÃO: não foi possível confirmar a limpeza automática.");}}}
 finally{token=null;btn.disabled=false;}
});
</script></html>`;
  const h=new Headers(headers);h.set("Content-Type","text/html; charset=utf-8");h.set("Cache-Control","no-store");h.set("Content-Security-Policy","default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self' https://jxzcuqwlnqxnhftffbjx.supabase.co; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  return new Response(html,{status:200,headers:h});
 }
 if(!url.pathname.startsWith("/api/v1/"))return json({ok:false,error:"Not found"},404,headers);
 const access=await requireUser(request,env,headers);if(access.response)return access.response;const uid=access.user.id;
 const isAdmin=Number(access.profile.is_admin)===1||Number(access.profile.admin_principal)===1||String(access.user.email||"").toLowerCase()==="lucasviniciusfk@gmail.com";

 // Recompensas periódicas: replica as regras v507/v512, com identidade derivada da sessão.
 if(url.pathname==="/api/v1/rewards/period"&&request.method==="POST"){
  try{
   const body=await readBody(request),kind=validText(body.kind,10,"Tipo",true).toLowerCase(),period=validText(body.period_key,10,"Período",true);
   if(kind!=="weekly"&&kind!=="monthly")return json({ok:false,error:"Tipo de meta periódica inválido."},400,headers);
   let start,end;
   if(kind==="weekly"){
    if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(period)||Number.isNaN(Date.parse(period+"T00:00:00Z"))||new Date(period+"T00:00:00Z").toISOString().slice(0,10)!==period)return json({ok:false,error:"Período semanal inválido."},400,headers);
    start=new Date(period+"T00:00:00Z");end=new Date(start.getTime()+7*86400000);
   }else{
    if(!/^[0-9]{4}-[0-9]{2}$/.test(period)||Number.isNaN(Date.parse(period+"-01T00:00:00Z"))||new Date(period+"-01T00:00:00Z").toISOString().slice(0,7)!==period)return json({ok:false,error:"Período mensal inválido."},400,headers);
    start=new Date(period+"-01T00:00:00Z");end=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,1));
   }
   // O RPC original interpreta os limites de período no fuso America/Manaus (UTC-4).
   const from=new Date(start.getTime()+4*3600000).toISOString(),to=new Date(end.getTime()+4*3600000).toISOString();
   let current=Number(body.current),target=Number(body.target),xpAdd=Math.max(0,Math.floor(Number(body.xp)||0)),pointsAdd=Math.max(0,Math.floor(Number(body.points)||0));
   if(!Number.isFinite(current)||!Number.isFinite(target))return json({ok:false,error:"Progresso e meta precisam ser números válidos."},400,headers);
   current=Math.floor(current);target=Math.floor(target);
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
      AND lower(COALESCE(json_extract(dados,'$.system_hidden'),'false'))<>'true'
      AND COALESCE(origem,'') NOT LIKE 'auto_reward_%'
      AND (lower(COALESCE(json_extract(dados,'$.v512_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v511_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v510_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v509_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v508_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v507_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v506_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v483_monthly_applied'),'false'))='true' OR COALESCE(json_extract(dados,'$.v483_book_finalized_at'),'')<>'' OR COALESCE(json_extract(dados,'$.finishApprovedAt'),'')<>'')
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
   const manual=await env.DB.prepare("SELECT id FROM solicitacoes_validacao WHERE usuario_id=? AND created_at>=? AND created_at<? AND lower(status) IN ('approved','aprovado','aprovada') AND ((?='weekly' AND (lower(tipo) LIKE '%seman%' OR lower(COALESCE(json_extract(dados,'$.request_kind'),''))='weekly')) OR (?='monthly' AND (lower(tipo) LIKE '%mens%' OR lower(COALESCE(json_extract(dados,'$.request_kind'),''))='monthly'))) AND (lower(COALESCE(json_extract(dados,'$.v507_reward_applied'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v506_reward_applied'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v491_reward_applied'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v488_reward_applied'),'false'))='true') LIMIT 1").bind(uid,from,to,kind,kind).first();
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
   await env.DB.batch([
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
   const applied=!!c&&c.applied===1;
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
  }catch(e){return json({ok:false,error:"Não foi possível armazenar o arquivo no staging."},500,headers);}
 }
 if(fileRoute&&request.method==="GET"){
  try{
   const id=decodeURIComponent(fileRoute[1]),asset=await env.DB.prepare("SELECT id,owner_id,object_key,content_type,original_name,size_bytes FROM file_assets WHERE id=? AND owner_id=? AND deleted_at IS NULL LIMIT 1").bind(id,uid).first();
   if(!asset)return json({ok:false,error:"Arquivo não encontrado."},404,headers);
   const object=await env.FILES.get(asset.object_key);if(!object)return json({ok:false,error:"Arquivo indisponível no armazenamento."},404,headers);
   const outHeaders=new Headers(headers);outHeaders.set("Content-Type",asset.content_type);outHeaders.set("Content-Length",String(asset.size_bytes));outHeaders.set("Content-Disposition",'inline; filename="'+asset.original_name.replace(/["\\\r\n]/g,"_")+'"');outHeaders.set("Cache-Control","private, no-store");outHeaders.set("X-Content-Type-Options","nosniff");
   return new Response(object.body,{status:200,headers:outHeaders});
  }catch(e){return json({ok:false,error:"Não foi possível recuperar o arquivo."},500,headers);}
 }
 if(fileRoute&&request.method==="DELETE"){
  try{
   const id=decodeURIComponent(fileRoute[1]),asset=await env.DB.prepare("SELECT id,object_key FROM file_assets WHERE id=? AND owner_id=? AND deleted_at IS NULL LIMIT 1").bind(id,uid).first();
   if(!asset)return json({ok:false,error:"Arquivo não encontrado."},404,headers);
   // Primeiro bloqueia o acesso no D1; se a exclusão do R2 falhar, o objeto fica inacessível pela API e pode ser limpo depois.
   const stamp=new Date().toISOString();
   const result=await env.DB.prepare("UPDATE file_assets SET deleted_at=? WHERE id=? AND owner_id=? AND deleted_at IS NULL").bind(stamp,id,uid).run();
   if(!result.meta||result.meta.changes!==1)return json({ok:false,error:"Não foi possível confirmar a remoção do arquivo."},409,headers);
   await env.FILES.delete(asset.object_key);
   return json({ok:true,deleted:true,id:id},200,headers);
  }catch(e){return json({ok:false,error:"Arquivo bloqueado para acesso; a limpeza do armazenamento pode precisar ser repetida."},500,headers);}
 }
 try{
  if(request.method==="GET"&&url.pathname==="/api/v1/me"){const p=await env.DB.prepare("SELECT id,nome,email,foto_url,bio,livro_favorito,nivel,xp,paginas_lidas,livros_finalizados,sequencia_dias,moldura_ativa,perfil_privado,biblioteca_publica,moldura_atual,criado_em,estado FROM usuarios WHERE id=? LIMIT 1").bind(uid).first();return json({ok:true,user:{id:uid,email:access.user.email||p.email},profile:p},200,headers);}
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
    const sql="SELECT COUNT(DISTINCT COALESCE(NULLIF(json_extract(dados,'$.v511_cycle_id'),''),NULLIF(json_extract(dados,'$.v508_resolved_book_id'),''),NULLIF(json_extract(dados,'$.book_id'),''),NULLIF(json_extract(dados,'$.livro_id'),''),NULLIF(lower(trim(COALESCE(json_extract(dados,'$.bookTitle'),json_extract(dados,'$.livro_titulo'),''))),''),id)) AS total FROM solicitacoes_validacao WHERE usuario_id=? AND lower(COALESCE(status,'')) IN ('approved','aprovado','aprovada') AND lower(COALESCE(json_extract(dados,'$.system_hidden'),'false'))<>'true' AND COALESCE(origem,'') NOT LIKE 'auto_reward_%' AND (lower(COALESCE(json_extract(dados,'$.v512_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v511_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v510_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v509_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v508_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v507_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v506_approved'),'false'))='true' OR lower(COALESCE(json_extract(dados,'$.v483_monthly_applied'),'false'))='true' OR COALESCE(json_extract(dados,'$.v483_book_finalized_at'),'')<>'' OR COALESCE(json_extract(dados,'$.finishApprovedAt'),'')<>'') AND substr(COALESCE(json_extract(dados,'$.v512_approved_at'),json_extract(dados,'$.v511_approved_at'),json_extract(dados,'$.v510_approved_at'),json_extract(dados,'$.v509_approved_at'),json_extract(dados,'$.v508_approved_at'),json_extract(dados,'$.v507_approved_at'),json_extract(dados,'$.v506_approved_at'),json_extract(dados,'$.v483_book_finalized_at'),json_extract(dados,'$.finishApprovedAt'),created_at),1,7)=? AND (lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')||'|'||COALESCE(json_extract(dados,'$.v508_type'),'')||'|'||COALESCE(json_extract(dados,'$.v506_type'),'')) LIKE '%finish%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%finaliz%' OR (lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%monthly%' AND COALESCE(json_extract(dados,'$.bookTitle'),json_extract(dados,'$.livro_titulo'),json_extract(dados,'$.v508_resolved_book_id'),json_extract(dados,'$.book_id'),json_extract(dados,'$.livro_id'),'')<>'')) AND ( ?=0 OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%club_finish%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%livro do clube%' OR lower(COALESCE(tipo,'')||'|'||COALESCE(origem,'')||'|'||COALESCE(json_extract(dados,'$.request_kind'),'')) LIKE '%clube%')";
    const row=await env.DB.prepare(sql).bind(uid,period,kind.includes("clube")?1:0).first();current=Number(row&&row.total)||0;
   }
   return json({ok:true,period,type:kind,current:Math.max(0,current)},200,headers);
  }
  // Solicitações administrativas: apenas contas explicitamente marcadas como admin.

  if(url.pathname==="/api/v1/admin/requests"&&request.method==="GET"){
   if(!isAdmin)return json({ok:false,error:"Acesso administrativo não confirmado."},403,headers);
   const limit=clampInt(url.searchParams.get("limit"),100,1,200),status=String(url.searchParams.get("status")||"pending").toLowerCase();
   const allowed=["pending","processing","pendente","processando","approved","approved_all","rejected"];
   if(!allowed.includes(status))return json({ok:false,error:"Filtro de status inválido."},400,headers);
   const where=status==="approved_all"?"lower(COALESCE(status,'')) IN ('approved','aprovado','aprovada')":status==="rejected"?"lower(COALESCE(status,'')) IN ('rejected','recusado','recusada')":"lower(COALESCE(status,''))=?";
   const q=await env.DB.prepare("SELECT id,usuario_id,usuario_nome,tipo,livro_id,livro_titulo,paginas,status,origem,livro,resenha,prova,comprovante,dados,xp,pontos,created_at,criado_em,updated_at,atualizado_em FROM solicitacoes_validacao WHERE "+where+" ORDER BY COALESCE(created_at,criado_em) DESC LIMIT ?").bind(...(status==="approved_all"||status==="rejected"?[limit]:[status,limit])).all();
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
   const upd=await env.DB.prepare("UPDATE solicitacoes_validacao SET status='rejected',dados=json_set(COALESCE(dados,'{}'),'$.v507_rejected',true,'$.v507_rejected_at',?,'$.v507_reject_reason',?),resposta_admin=?,revisado_por=?,revisado_em=?,atualizado_em=? WHERE id=? AND lower(COALESCE(status,'pending')) NOT IN ('approved','aprovado','aprovada','rejected','recusado','recusada')").bind(stamp,reason,reason,uid,stamp,stamp,requestId).run();
   return json({ok:true,applied:Number(upd.meta&&upd.meta.changes)>0,status:"rejected"},200,headers);
  }
  if(url.pathname==="/api/v1/club/albums"&&request.method==="POST"){
   if(!isAdmin)return json({ok:false,error:"Somente a administração pode criar álbuns."},403,headers);
   const body=await readBody(request),name=validText(body.name,180,"Nome do álbum",true);
   const id=crypto.randomUUID(),stamp=new Date().toISOString();
   const date=validText(body.meeting_date||"",40,"Data do encontro"),place=validText(body.location||"",240,"Local");
   const bookTitle=validText(body.book_title||"",240,"Título do livro"),bookAuthor=validText(body.book_author||"",200,"Autor");
   const cover=validText(body.cover_url||"",2048,"Capa"),dynamics=typeof body.dynamics==="string"?body.dynamics.slice(0,12000):JSON.stringify(body.dynamics||[]);
   if(cover&&!/^https:/i.test(cover))return json({ok:false,error:"A capa precisa ser uma URL HTTPS."},400,headers);
   await env.DB.prepare("INSERT INTO clube_albuns(id,nome,data_encontro,local_encontro,livro_titulo,livro_autor,livro_capa_url,dinamicas,capa_url,trancado,ativo,criado_por,criado_em,atualizado_em) VALUES(?,?,?,?,?,?,?,?,?,0,1,?,?,?)").bind(id,name,date,place,bookTitle,bookAuthor,cover,dynamics,cover,uid,stamp,stamp).run();
   return json({ok:true,album:{id,nome:name,data_encontro:date,local_encontro:place,livro_titulo:bookTitle,livro_autor:bookAuthor,capa_url:cover,trancado:0,ativo:1,criado_em:stamp,atualizado_em:stamp}},201,headers);
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
   const cover=body.cover_url===undefined?old.capa_url:validText(body.cover_url,2048,"Capa");
   const dynamics=body.dynamics===undefined?old.dinamicas:(typeof body.dynamics==="string"?body.dynamics.slice(0,12000):JSON.stringify(body.dynamics||[]));
   const locked=body.locked===undefined?Number(old.trancado)||0:(body.locked?1:0);
   const active=body.active===undefined?Number(old.ativo)||0:(body.active?1:0);
   if(cover&&!/^https:/i.test(cover))return json({ok:false,error:"A capa precisa ser uma URL HTTPS."},400,headers);
   const stamp=new Date().toISOString();
   await env.DB.prepare("UPDATE clube_albuns SET nome=?,data_encontro=?,local_encontro=?,livro_titulo=?,livro_autor=?,livro_capa_url=?,dinamicas=?,capa_url=?,trancado=?,ativo=?,atualizado_em=? WHERE id=?").bind(name,date,place,bookTitle,bookAuthor,cover,dynamics,cover,locked,active,stamp,id).run();
   return json({ok:true,album:{id,nome:name,data_encontro:date,local_encontro:place,livro_titulo:bookTitle,livro_autor:bookAuthor,capa_url:cover,trancado:locked,ativo:active,atualizado_em:stamp}},200,headers);
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
   return json({ok:true,album_id:albumId,locked:Number(album.trancado)===1,items:rows.results||[],count:(rows.results||[]).length,limit},200,headers);
  }
  const clubPhotoContentRoute=url.pathname.match(new RegExp("^/api/v1/club/albums/photos/([^/]+)/content$"));
  if(clubPhotoContentRoute&&request.method==="GET"){
   const photoId=decodeURIComponent(clubPhotoContentRoute[1]);
   const photo=await env.DB.prepare("SELECT f.id,f.storage_path,f.origem_arquivo FROM clube_fotos f JOIN clube_albuns a ON a.id=f.album_id WHERE f.id=? AND COALESCE(f.ativo,1)=1 AND COALESCE(a.ativo,1)=1 LIMIT 1").bind(photoId).first();
   if(!photo||photo.origem_arquivo!=="r2-private-v1"||!photo.storage_path)return json({ok:false,error:"Foto não encontrada."},404,headers);
   const asset=await env.DB.prepare("SELECT object_key,content_type,original_name,size_bytes FROM file_assets WHERE id=? AND deleted_at IS NULL LIMIT 1").bind(photo.storage_path).first();
   if(!asset)return json({ok:false,error:"Arquivo da foto indisponível."},404,headers);
   const object=await env.FILES.get(asset.object_key);if(!object)return json({ok:false,error:"Arquivo da foto indisponível no R2."},404,headers);
   const safeName=String(asset.original_name||"foto").replace(/[^a-zA-Z0-9._-]/g,"_");outHeaders.set("Content-Disposition","inline; filename="+safeName);outHeaders.set("Cache-Control","private, no-store");outHeaders.set("X-Content-Type-Options","nosniff");
   return new Response(object.body,{status:200,headers:outHeaders});
  }
  if(url.pathname==="/api/v1/club/albums/photos"&&request.method==="POST"){
   if(!isAdmin)return json({ok:false,error:"Somente a administração pode adicionar fotos ao álbum."},403,headers);
   const body=await readBody(request),albumId=validText(body.album_id,128,"Álbum",true),fileId=validText(body.file_id,128,"Arquivo",true);
   const album=await env.DB.prepare("SELECT id FROM clube_albuns WHERE id=? AND COALESCE(ativo,1)=1 LIMIT 1").bind(albumId).first();
   if(!album)return json({ok:false,error:"Álbum não encontrado."},404,headers);
   const asset=await env.DB.prepare("SELECT id,category FROM file_assets WHERE id=? AND owner_id=? AND deleted_at IS NULL LIMIT 1").bind(fileId,uid).first();
   if(!asset||asset.category!=="club-photo")return json({ok:false,error:"Envie primeiro uma foto válida para o armazenamento privado do Clube."},404,headers);
   const existing=await env.DB.prepare("SELECT id FROM clube_fotos WHERE storage_path=? AND origem_arquivo='r2-private-v1' AND COALESCE(ativo,1)=1 LIMIT 1").bind(fileId).first();
   if(existing)return json({ok:true,already_attached:true,photo_id:existing.id},200,headers);
   const user=await env.DB.prepare("SELECT nome FROM usuarios WHERE id=? LIMIT 1").bind(uid).first();
   const photoId=crypto.randomUUID(),stamp=new Date().toISOString(),name=String(user&&user.nome||access.user.email||"Admin");
   await env.DB.prepare("INSERT INTO clube_fotos(id,album_id,url,storage_path,usuario_id,usuario_nome,ativo,criado_em,foto_url,origem_arquivo) VALUES(?,?,?,?,?,?,1,?,?,?)").bind(photoId,albumId,"private://"+fileId,fileId,uid,name,stamp,"private://"+fileId,"r2-private-v1").run();
   return json({ok:true,photo:{id:photoId,album_id:albumId,image_url:"/api/v1/club/albums/photos/"+encodeURIComponent(photoId)+"/content",created_at:stamp}},201,headers);
  }
  const clubPhotoRoute=url.pathname.match(new RegExp("^/api/v1/club/albums/photos/([^/]+)$"));
  if(clubPhotoRoute&&request.method==="DELETE"){
   if(!isAdmin)return json({ok:false,error:"Somente a administração pode remover fotos do álbum."},403,headers);
   const photoId=decodeURIComponent(clubPhotoRoute[1]),stamp=new Date().toISOString();
   const result=await env.DB.prepare("UPDATE clube_fotos SET ativo=0 WHERE id=? AND COALESCE(ativo,1)=1").bind(photoId).run();
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
    env.DB.prepare("INSERT OR IGNORE INTO entrel_reward_claims_v510(claim_key,usuario_id,source_type,source_id,xp,pontos,applied,created_at) VALUES(?,?,?,?,?,?,0,?)").bind(claim,userId,"club_finish",requestId,xp,points,stamp),
    env.DB.prepare("UPDATE usuarios SET xp=COALESCE(xp,0)+(SELECT xp FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0),pontos=COALESCE(pontos,0)+(SELECT pontos FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0),atualizado_em=? WHERE id=? AND EXISTS(SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0)").bind(claim,claim,stamp,userId,claim),
    env.DB.prepare("UPDATE entrel_reward_claims_v510 SET applied=1,applied_at=? WHERE claim_key=? AND applied=0").bind(stamp,claim),
    env.DB.prepare("UPDATE clube_livro_participantes SET finalizado=1,progresso_pct=100,pagina_atual=CASE WHEN ?>0 THEN MAX(COALESCE(pagina_atual,0),?) ELSE COALESCE(pagina_atual,0) END,recompensa_recebida=1,atualizado_em=? WHERE id=? AND usuario_id=? AND ciclo_id=?").bind(total,total,stamp,participant.id,userId,cycle),
    env.DB.prepare("UPDATE solicitacoes_validacao SET status='approved',dados=json_set(COALESCE(dados,'{}'),'$.v511_approved',true,'$.v511_approved_at',?,'$.v511_cycle_id',?,'$.v511_reward_claim',?,'$.v511_admin_reason',?),resposta_admin=?,revisado_por=?,revisado_em=?,atualizado_em=? WHERE id=? AND lower(COALESCE(status,'pending')) NOT IN ('approved','aprovado','aprovada','rejected','recusado','recusada')").bind(stamp,cycle,claim,reason,reason,uid,stamp,stamp,requestId)
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
   if(["approved","aprovado","aprovada"].includes(status))return json({ok:true,applied:false,already_reviewed:true,status:"approved"},200,headers);
   if(["rejected","recusado","recusada"].includes(status))return json({ok:false,error:"Esta solicitação já foi recusada."},409,headers);
   const data=parseObject(req.dados),userId=String(req.usuario_id||"");
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
   const total=Math.max(1,Number(book.paginas)||Number(req.paginas)||Number(data.paginas)||1),xp=Math.max(0,Number(req.xp??data.xp??data.rewardXp)||0),points=Math.max(0,Number(req.pontos??data.pontos??data.rewardPoints)||10),stamp=new Date().toISOString(),claim="bookfinish:"+userId+":"+book.id;
   const oldBookData=parseObject(book.dados);const newBookData=JSON.stringify({...oldBookData,finishPending:false,finished:true,finalizado:true,finishedAt:oldBookData.finishedAt||stamp,finishApprovedAt:stamp,finishRequestId:requestId,finishRewardClaim:claim,v510:true});
   const batch=[
    env.DB.prepare("INSERT OR IGNORE INTO entrel_reward_claims_v510(claim_key,usuario_id,source_type,source_id,xp,pontos,applied,created_at) VALUES(?,?,?,?,?,?,0,?)").bind(claim,userId,"book_finish",requestId,xp,points,stamp),
    env.DB.prepare("UPDATE usuarios SET xp=COALESCE(xp,0)+(SELECT xp FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0),pontos=COALESCE(pontos,0)+(SELECT pontos FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0),atualizado_em=? WHERE id=? AND EXISTS(SELECT 1 FROM entrel_reward_claims_v510 WHERE claim_key=? AND applied=0)").bind(claim,claim,stamp,userId,claim),
    env.DB.prepare("UPDATE entrel_reward_claims_v510 SET applied=1,applied_at=? WHERE claim_key=? AND applied=0").bind(stamp,claim),
    env.DB.prepare("UPDATE livros_pessoais SET pagina_atual=?,progresso=100,status='finished',ativo=1,dados=?,atualizado_em=?,finalizado_em=? WHERE id=? AND usuario_id=?").bind(total,newBookData,stamp,stamp,book.id,userId),
    env.DB.prepare("INSERT INTO leituras(usuario_id,livro_id,pagina_atual,porcentagem,progresso,finalizado,status,dados,atualizado_em) VALUES(?,?,?,100,100,1,'finished',?,?) ON CONFLICT(usuario_id,livro_id) DO UPDATE SET pagina_atual=excluded.pagina_atual,porcentagem=100,progresso=100,finalizado=1,status='finished',dados=excluded.dados,atualizado_em=excluded.atualizado_em").bind(userId,book.id,total,JSON.stringify({v510:true,requestId}),stamp),
    env.DB.prepare("UPDATE solicitacoes_validacao SET status='approved',dados=json_set(COALESCE(dados,'{}'),'$.v510_approved',true,'$.v510_approved_at',?,'$.v510_type','finish','$.v510_reward_claim',?,'$.v510_resolved_book_id',?,'$.v510_admin_reason',?),resposta_admin=?,revisado_por=?,revisado_em=?,atualizado_em=? WHERE id=? AND lower(COALESCE(status,'pending')) NOT IN ('approved','aprovado','aprovada','rejected','recusado','recusada')").bind(stamp,claim,book.id,reason,reason,uid,stamp,stamp,requestId)
   ];
   await env.DB.batch(batch);
   const balances=await env.DB.prepare("SELECT xp,pontos FROM usuarios WHERE id=?").bind(userId).first();
   return json({ok:true,status:"approved",book_id:book.id,user_id:userId,xp:Number(balances&&balances.xp)||0,points:Number(balances&&balances.pontos)||0,claim_key:claim},200,headers);
  }

  // Notificações: leitura e estado individual; nenhuma escrita dispara push.
  if(request.method==="GET"&&url.pathname==="/api/v1/notifications"){
   const limit=clampInt(url.searchParams.get("limit"),50,1,100);
   const rows=await env.DB.prepare(`SELECT id,usuario_id,target_id,titulo,mensagem,tipo,lida,lida_por,ocultada_por,origem,dados,criada_em,atualizado_em
    FROM app_notificacoes
    WHERE (usuario_id=? OR target_id=? OR (usuario_id='all' AND target_id='all'))
      AND NOT EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(ocultada_por) THEN ocultada_por ELSE '[]' END) WHERE value=?)
    ORDER BY criada_em DESC,id DESC LIMIT ?`).bind(uid,uid,uid,limit).all();
   const items=(rows.results||[]).map(n=>{
    let readBy=[],hiddenBy=[],data={};
    try{readBy=JSON.parse(n.lida_por||"[]");if(!Array.isArray(readBy))readBy=[];}catch(_){}
    try{hiddenBy=JSON.parse(n.ocultada_por||"[]");if(!Array.isArray(hiddenBy))hiddenBy=[];}catch(_){}
    try{data=JSON.parse(n.dados||"{}");if(!data||typeof data!=="object"||Array.isArray(data))data={};}catch(_){}
    const personal=n.usuario_id===uid||n.target_id===uid;
    return {...n,dados:data,lida:personal?(n.lida===1||n.lida===true):((n.lida===1||n.lida===true)||readBy.includes(uid)),ocultada_por:undefined,lida_por:undefined};
   });
   return json({ok:true,items,count:items.length},200,headers);
  }
  const notificationAction=url.pathname.match(/^\/api\/v1\/notifications\/([^/]+)\/(read|hide)$/);
  if(request.method==="POST"&&notificationAction){
   const notificationId=decodeURIComponent(notificationAction[1]),action=notificationAction[2];
   const row=await env.DB.prepare("SELECT id,usuario_id,target_id,lida,lida_por,ocultada_por FROM app_notificacoes WHERE id=? AND (usuario_id=? OR usuario_id='all' OR target_id=? OR target_id='all') LIMIT 1").bind(notificationId,uid,uid).first();
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
  // Chat: identidade e permissões derivadas da sessão; mensagens removidas ficam preservadas para auditoria.
  if(request.method==="GET"&&url.pathname==="/api/v1/chat/messages"){
   const limit=clampInt(url.searchParams.get("limit"),250,1,300);
   const rows=await env.DB.prepare("SELECT id,usuario_id,mensagem,fixada,criado_em,editada,apagada,atualizado_em,reacoes,reagido_por,curtidas,nome,texto,removida,dados,editado_em FROM chat_mensagens WHERE COALESCE(removida,0)=0 AND COALESCE(apagada,0)=0 ORDER BY criado_em DESC,id DESC LIMIT ?").bind(limit).all();
   const items=(rows.results||[]).reverse();
   const ids=items.map(x=>String(x.id));
   let reactions=[];
   if(ids.length){
    const marks=ids.map(()=>"?").join(",");
    const rr=await env.DB.prepare("SELECT id,mensagem_id,usuario_id,emoji,criado_em,atualizado_em FROM chat_reacoes WHERE mensagem_id IN ("+marks+") ORDER BY criado_em ASC").bind(...ids).all();
    reactions=rr.results||[];
   }
   const byMessage={};for(const r of reactions){const key=String(r.mensagem_id);if(!byMessage[key])byMessage[key]=[];byMessage[key].push(r);}
   for(const m of items){m.dados=parseObject(m.dados);m.reacoes=parseObject(m.reacoes);m.reaction_items=byMessage[String(m.id)]||[];}
   return json({ok:true,items,reactions,count:items.length,limit},200,headers);
  }
  if(request.method==="POST"&&url.pathname==="/api/v1/chat/messages"){
   const b=await readBody(request),message=validText(b.message,4000,"Mensagem",true);
   const profile=await env.DB.prepare("SELECT nome FROM usuarios WHERE id=? LIMIT 1").bind(uid).first();
   const stamp=new Date().toISOString(),id=crypto.randomUUID(),reply=b.reply&&typeof b.reply==="object"?{id:validText(b.reply.id,128,"ID da resposta"),userName:validText(b.reply.userName||"Membro",120,"Nome"),text:validText(b.reply.text||"",240,"Trecho")}:null;
   const dados=JSON.stringify(Object.assign({tipo:"mensagem"},reply?{reply}:{}));
   await env.DB.prepare("INSERT INTO chat_mensagens (id,usuario_id,mensagem,fixada,criado_em,editada,apagada,atualizado_em,reacoes,reagido_por,curtidas,nome,texto,removida,dados,editado_em) VALUES (?,?,?,0,?,0,0,?,'{}','[]','[]',?,?,0,?,NULL)").bind(id,uid,message,stamp,stamp,String(profile&&profile.nome||access.user.email||"Membro"),message,dados).run();
   const item=await env.DB.prepare("SELECT id,usuario_id,mensagem,fixada,criado_em,editada,apagada,atualizado_em,reacoes,reagido_por,curtidas,nome,texto,removida,dados,editado_em FROM chat_mensagens WHERE id=?").bind(id).first();
   item.dados=parseObject(item.dados);item.reaction_items=[];
   return json({ok:true,message:item},201,headers);
  }
  const chatMessageRoute=url.pathname.match(/^\/api\/v1\/chat\/messages\/([^/]+)$/);
  if(chatMessageRoute&&(request.method==="PATCH"||request.method==="DELETE")){
   const messageId=decodeURIComponent(chatMessageRoute[1]),row=await env.DB.prepare("SELECT id,usuario_id,mensagem,criado_em,fixada,removida FROM chat_mensagens WHERE id=? LIMIT 1").bind(messageId).first();
   if(!row||row.removida===1)return json({ok:false,error:"Mensagem não encontrada."},404,headers);
   const owner=String(row.usuario_id||"")===uid;
   if(request.method==="PATCH"){
    if(!owner)return json({ok:false,error:"Somente o autor pode editar esta mensagem."},403,headers);
    const body=await readBody(request),message=validText(body.message,4000,"Mensagem",true),stamp=new Date().toISOString();
    await env.DB.prepare("UPDATE chat_mensagens SET mensagem=?,texto=?,editada=1,editado_em=?,atualizado_em=? WHERE id=? AND usuario_id=? AND COALESCE(removida,0)=0").bind(message,message,stamp,stamp,messageId,uid).run();
    return json({ok:true,id:messageId,message,edited_at:stamp},200,headers);
   }
   const created=Date.parse(row.criado_em||"")||0,withinWindow=created>0&&Date.now()-created<=30*60*1000;
   if(!isAdmin&&!(owner&&withinWindow))return json({ok:false,error:"Você só pode apagar suas mensagens por até 30 minutos."},403,headers);
   const stamp=new Date().toISOString();
   await env.DB.batch([
    env.DB.prepare("UPDATE chat_mensagens SET removida=1,apagada=1,atualizado_em=? WHERE id=? AND COALESCE(removida,0)=0").bind(stamp,messageId),
    env.DB.prepare("DELETE FROM chat_reacoes WHERE mensagem_id=?").bind(messageId)
   ]);
   return json({ok:true,id:messageId,removed:true},200,headers);
  }
  const chatReactionRoute=url.pathname.match(/^\/api\/v1\/chat\/messages\/([^/]+)\/reaction$/);
  if(chatReactionRoute&&request.method==="PUT"){
   const messageId=decodeURIComponent(chatReactionRoute[1]),body=await readBody(request),emoji=validText(body.emoji,16,"Emoji",true);
   const message=await env.DB.prepare("SELECT id FROM chat_mensagens WHERE id=? AND COALESCE(removida,0)=0 AND COALESCE(apagada,0)=0 LIMIT 1").bind(messageId).first();
   if(!message)return json({ok:false,error:"Mensagem não encontrada."},404,headers);
   const stamp=new Date().toISOString();
   await env.DB.prepare("INSERT INTO chat_reacoes (id,mensagem_id,usuario_id,emoji,criado_em,atualizado_em) VALUES (?,?,?,?,?,?) ON CONFLICT(mensagem_id,usuario_id) DO UPDATE SET emoji=excluded.emoji,atualizado_em=excluded.atualizado_em").bind(crypto.randomUUID(),messageId,uid,emoji,stamp,stamp).run();
   return json({ok:true,message_id:messageId,emoji},200,headers);
  }
  if(chatReactionRoute&&request.method==="DELETE"){
   const messageId=decodeURIComponent(chatReactionRoute[1]);
   await env.DB.prepare("DELETE FROM chat_reacoes WHERE mensagem_id=? AND usuario_id=?").bind(messageId,uid).run();
   return json({ok:true,message_id:messageId,removed:true},200,headers);
  }
  if(request.method==="GET"&&url.pathname==="/api/v1/challenges"){const [c,p]=await Promise.all([env.DB.prepare("SELECT * FROM desafios WHERE COALESCE(ativo,1)=1 ORDER BY criado_em DESC LIMIT 200").all(),env.DB.prepare("SELECT * FROM usuario_desafios WHERE usuario_id=? ORDER BY atualizado_em DESC LIMIT 500").bind(uid).all()]);return json({ok:true,items:c.results||[],progress:p.results||[]},200,headers);}
  if(request.method==="POST"&&url.pathname==="/api/v1/library/books"){const b=await readBody(request),title=validText(b.title,240,"Título",true),author=validText(b.author,200,"Autor",true),genre=validText(b.genre||"Outro",100,"Gênero"),pages=clampInt(b.pages,100,1,100000);if(b.current_page!==undefined&&(!Number.isInteger(Number(b.current_page))||Number(b.current_page)<0||Number(b.current_page)>pages))return json({ok:false,error:"A página atual precisa estar entre 0 e o total de páginas."},400,headers);const currentPage=clampInt(b.current_page,0,0,pages),cover=validText(b.cover_url||"",2048,"Capa"),cfi=validText(b.epub_cfi||"",4096,"Posição EPUB"),requestedStatus=String(b.status||"reading").toLowerCase(),status=["reading","pending_finish","finished"].includes(requestedStatus)?requestedStatus:"reading",progress=Math.max(0,Math.min(100,Math.round(currentPage/pages*100))),finished=status==="finished"||currentPage>=pages,finalStatus=finished?"finished":status;if(cover&&!/^https:/i.test(cover))return json({ok:false,error:"A capa precisa ser uma URL HTTPS."},400,headers);const all=await env.DB.prepare("SELECT id,titulo,autor FROM livros_pessoais WHERE usuario_id=? AND COALESCE(ativo,1)=1 LIMIT 500").bind(uid).all();const dup=(all.results||[]).find(x=>clean(x.titulo)===clean(title)&&clean(x.autor)===clean(author));if(dup)return json({ok:false,error:"Este livro já está na sua biblioteca.",existing_book_id:dup.id},409,headers);const id=crypto.randomUUID(),stamp=new Date().toISOString(),dados=JSON.stringify({source:"personal-manual-online",finishPending:finalStatus==="pending_finish",createdFrom:"manual",schemaVersion:1});await env.DB.prepare("INSERT INTO livros_pessoais (id,usuario_id,livro_id,titulo,autor,genero,paginas,capa,capa_url,epub_storage_path,pagina_atual,progresso,epub_cfi,status,ativo,dados,publico,criado_em,atualizado_em,finalizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,uid,id,title,author,genre,pages,cover,cover,"",currentPage,progress,cfi,finalStatus,1,dados,0,stamp,stamp,finished?stamp:null).run();const book=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? LIMIT 1").bind(id,uid).first();return json({ok:true,book},201,headers);}
  const route=url.pathname.match(/^\/api\/v1\/library\/books\/([^/]+)$/);if(route&&request.method==="GET"){const id=decodeURIComponent(route[1]),book=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? AND COALESCE(ativo,1)=1 LIMIT 1").bind(id,uid).first();if(!book)return json({ok:false,error:"Livro não encontrado."},404,headers);return json({ok:true,book},200,headers);}if(route&&(request.method==="PATCH"||request.method==="DELETE")){const id=decodeURIComponent(route[1]),book=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? LIMIT 1").bind(id,uid).first();if(!book)return json({ok:false,error:"Livro não encontrado."},404,headers);if(request.method==="DELETE"){const stamp=new Date().toISOString();await env.DB.prepare("UPDATE livros_pessoais SET ativo=0,atualizado_em=? WHERE id=? AND usuario_id=?").bind(stamp,id,uid).run();return json({ok:true,removed:true,book_id:id},200,headers);}const b=await readBody(request),title=b.title===undefined?book.titulo:validText(b.title,240,"Título",true),author=b.author===undefined?book.autor:validText(b.author,200,"Autor",true),genre=b.genre===undefined?book.genero:validText(b.genre,100,"Gênero"),pages=b.pages===undefined?(Number(book.paginas)||100):clampInt(b.pages,Number(book.paginas)||100,1,100000);if(b.current_page!==undefined&&(!Number.isInteger(Number(b.current_page))||Number(b.current_page)<0||Number(b.current_page)>pages))return json({ok:false,error:"A página atual precisa estar entre 0 e o total de páginas."},400,headers);if(b.pages!==undefined&&Number(book.pagina_atual)>pages&&b.current_page===undefined)return json({ok:false,error:"O total de páginas não pode ficar abaixo da página de leitura atual."},409,headers);const cover=b.cover_url===undefined?(book.capa_url||""):validText(b.cover_url,2048,"Capa"),page=b.current_page===undefined?clampInt(book.pagina_atual,0,0,pages):clampInt(b.current_page,0,0,pages),cfi=b.epub_cfi===undefined?String(book.epub_cfi||""):validText(b.epub_cfi,4096,"Posição EPUB"),rawStatus=b.status===undefined?String(book.status||"reading"):String(b.status).toLowerCase();if(!["reading","pending_finish","finished"].includes(rawStatus))return json({ok:false,error:"Status de leitura inválido."},400,headers);if(cover&&!/^https:/i.test(cover))return json({ok:false,error:"A capa precisa ser uma URL HTTPS."},400,headers);const progress=Math.max(0,Math.min(100,Math.round(page/pages*100))),status=page>=pages?"finished":rawStatus,finished=status==="finished",stamp=new Date().toISOString(),dados=JSON.stringify(Object.assign({},parseObject(book.dados),{finishPending:status==="pending_finish"})),bookKey=String(book.livro_id||book.id),rid=crypto.randomUUID();await env.DB.batch([env.DB.prepare("UPDATE livros_pessoais SET titulo=?,autor=?,genero=?,paginas=?,capa=?,capa_url=?,pagina_atual=?,progresso=?,epub_cfi=?,status=?,finalizado_em=CASE WHEN ?=1 THEN COALESCE(finalizado_em,?) ELSE NULL END,dados=?,atualizado_em=? WHERE id=? AND usuario_id=?").bind(title,author,genre,pages,cover,cover,page,progress,cfi,status,finished?1:0,stamp,dados,stamp,id,uid),env.DB.prepare("INSERT INTO leituras (id,usuario_id,livro_id,pagina_atual,porcentagem,finalizado,atualizado_em,progresso,epub_cfi,status,dados) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(usuario_id,livro_id) DO UPDATE SET pagina_atual=excluded.pagina_atual,porcentagem=excluded.porcentagem,finalizado=excluded.finalizado,atualizado_em=excluded.atualizado_em,progresso=excluded.progresso,epub_cfi=excluded.epub_cfi,status=excluded.status,dados=excluded.dados").bind(rid,uid,bookKey,page,progress,finished?1:0,stamp,progress,cfi,status,dados)]);const updated=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? LIMIT 1").bind(id,uid).first();return json({ok:true,book:updated},200,headers);}
  if(request.method==="POST"&&url.pathname==="/api/v1/reading"){const b=await readBody(request),bookId=validText(b.book_id,128,"Identificador do livro",true),book=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? AND COALESCE(ativo,1)=1 LIMIT 1").bind(bookId,uid).first();if(!book)return json({ok:false,error:"Livro ativo não encontrado na sua biblioteca."},404,headers);const pages=Math.max(1,Number(book.paginas)||1),page=clampInt(b.current_page,Number(book.pagina_atual)||0,0,pages);if(b.current_page!==undefined&&(!Number.isInteger(Number(b.current_page))||Number(b.current_page)<0||Number(b.current_page)>pages))return json({ok:false,error:"A página atual precisa estar entre 0 e o total de páginas."},400,headers);const progress=Math.max(0,Math.min(100,Math.round(page/pages*100))),stamp=new Date().toISOString(),old=String(book.status||"reading"),status=/pending_finish|aguardando/i.test(old)?"pending_finish":(/finished|finalizado|concluido|concluído/i.test(old)||page>=pages?"finished":"reading"),cfi=validText(b.epub_cfi===undefined?book.epub_cfi:b.epub_cfi,4096,"Posição EPUB"),dados=JSON.stringify(Object.assign({},parseObject(book.dados),{lastProgressSource:"reader",lastProgressAt:stamp,lastReadAt:stamp})),finished=status==="finished"?1:0,readId=crypto.randomUUID();await env.DB.batch([env.DB.prepare("UPDATE livros_pessoais SET pagina_atual=?,progresso=?,epub_cfi=?,status=?,finalizado_em=CASE WHEN ?=1 THEN COALESCE(finalizado_em,?) ELSE finalizado_em END,dados=?,atualizado_em=? WHERE id=? AND usuario_id=? AND COALESCE(ativo,1)=1").bind(page,progress,cfi,status,finished,stamp,dados,stamp,bookId,uid),env.DB.prepare("INSERT INTO leituras (id,usuario_id,livro_id,pagina_atual,porcentagem,finalizado,atualizado_em,progresso,epub_cfi,status,dados) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(usuario_id,livro_id) DO UPDATE SET pagina_atual=excluded.pagina_atual,porcentagem=excluded.porcentagem,finalizado=excluded.finalizado,atualizado_em=excluded.atualizado_em,progresso=excluded.progresso,epub_cfi=excluded.epub_cfi,status=excluded.status,dados=excluded.dados").bind(readId,uid,String(book.livro_id||book.id),page,progress,finished,stamp,progress,cfi,status,dados)]);const updated=await env.DB.prepare("SELECT * FROM livros_pessoais WHERE id=? AND usuario_id=? LIMIT 1").bind(bookId,uid).first(),reading=await env.DB.prepare("SELECT * FROM leituras WHERE usuario_id=? AND livro_id=? LIMIT 1").bind(uid,String(book.livro_id||book.id)).first();return json({ok:true,book:updated,reading},200,headers);}
  return json({ok:false,error:"Rota não encontrada ou método não permitido."},404,headers);
 }catch(error){const message=String(error&&error.message||error),bad=/obrigatório|excede|muito grande|inválido|limite|URL HTTPS/i.test(message);return json({ok:false,error:bad?message:"Falha ao processar a operação de staging."},bad?400:500,headers);}
}};