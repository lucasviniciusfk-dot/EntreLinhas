import {readFileSync,writeFileSync} from 'node:fs';
const path=new URL('../cloudflare/worker.mjs',import.meta.url);
let code=readFileSync(path,'utf8');
function once(a,b){if(code.split(a).length!==2)throw new Error('Worker anchor missing/ambiguous: '+a.slice(0,80));code=code.replace(a,b);}
once('const cors = (origin) => {', 'import {handleProfile,bootstrapProfile} from "./domains/profile.mjs";\nconst cors = (origin) => {');
once('"http://localhost:5173"]','"http://localhost:5173","http://localhost:8787","https://entrelinhasoff.netlify.app","https://deploy-preview-4--entrelinhasoff.netlify.app"]');
once('GET, POST, PATCH, DELETE, OPTIONS','GET, POST, PUT, PATCH, DELETE, OPTIONS');
once('const url=new URL(request.url);','headers.set("Cache-Control","private, no-store");\n const url=new URL(request.url);');
const authAnchor='const access=await requireUser(request,env,headers);';
once(authAnchor,`if(url.pathname==="/api/v1/me/bootstrap"&&request.method==="POST"){
   let identity;
   try{identity=await authenticate(request,env);}catch(_){return json({ok:false,error:"Serviço de autenticação indisponível."},503,headers);}
   if(identity.error)return json({ok:false,error:"Sessão não confirmada."},identity.error==="upstream"?503:401,headers);
   try{await bootstrapProfile(env,identity.user);}catch(_){return json({ok:false,error:"Não foi possível preparar o perfil."},503,headers);}
 }
 `+authAnchor);
once(' // Recompensas periódicas:', ' const profileResponse=await handleProfile(request,env,{uid,headers,authUser:access.user});if(profileResponse)return profileResponse;\n\n // Recompensas periódicas:');
const start=code.indexOf('  if(request.method==="PATCH"&&url.pathname==="/api/v1/me")');
const end=code.indexOf('  if(request.method==="GET"&&url.pathname==="/api/v1/club/current-book")',start);
if(start<0||end<start)throw new Error('Old profile route boundary missing.');
code=code.slice(0,start)+code.slice(end);
// Bootstrap flows through the same self-profile handler after creating or finding the row.
once('const profileResponse=await handleProfile(request,env,{uid,headers,authUser:access.user});',
 'const profileRequest=url.pathname==="/api/v1/me/bootstrap"?new Request(url.origin+"/api/v1/me",{headers:request.headers}):request;\n const profileResponse=await handleProfile(profileRequest,env,{uid,headers,authUser:access.user});');
once('const safeName=String(asset.original_name||"foto").replace', 'const outHeaders=new Headers(headers);outHeaders.set("Content-Type",asset.content_type);outHeaders.set("Content-Length",String(asset.size_bytes));\n   const safeName=String(asset.original_name||"foto").replace');
// Exact same visibility predicate for reading a notification and changing its state.
once("(usuario_id=? OR usuario_id='all' OR target_id=? OR target_id='all')","(usuario_id=? OR target_id=? OR (usuario_id='all' AND target_id='all'))");
// D1 imported schemas have no generated UUID default, unlike Postgres.
once('INSERT INTO leituras(usuario_id,livro_id,pagina_atual,porcentagem,progresso,finalizado,status,dados,atualizado_em) VALUES(?,?,?,100,100,1,\'finished\',?,?)',
 'INSERT INTO leituras(id,usuario_id,livro_id,pagina_atual,porcentagem,progresso,finalizado,status,dados,atualizado_em) VALUES(?,?,?,?,100,100,1,\'finished\',?,?)');
once('.bind(userId,book.id,total,JSON.stringify({v510:true,requestId}),stamp)', '.bind(crypto.randomUUID(),userId,book.id,total,JSON.stringify({v510:true,requestId}),stamp)');
writeFileSync(path,code);
console.log('Upgraded Worker profile dispatch, CORS, private photos, notification ownership and reading UUID.');
