import {Miniflare,Response} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../cloudflare/',import.meta.url));
export async function runtime() {
  const mf = new Miniflare({
    modules:true, scriptPath:root+'worker.mjs', modulesRoot:root,
    compatibilityDate:'2026-11-09',
    d1Databases:['DB'],r2Buckets:['FILES'],
    bindings:{SUPABASE_URL:'https://auth.test',SUPABASE_PUBLISHABLE_KEY:'test-public'},
    outboundService:request=>{
      const token=(request.headers.get('Authorization')||'').replace('Bearer ','');
      if(token==='unavailable')return Response.json({error:'unavailable'},{status:503});
      if(!['alice','bob','admin','new'].includes(token))return Response.json({error:'invalid'},{status:401});
      return Response.json({id:token,email:token+'@example.test',user_metadata:{full_name:token, is_admin:true}});
    }
  });
  const db=await mf.getD1Database('DB');
  const files=await mf.getR2Bucket('FILES');
  const schema=readFileSync(root+'schema.staging.sql','utf8').replace(/CREATE TABLE _cf_KV[\s\S]+?WITHOUT ROWID;/,'');
  // D1 exec accepts one statement per line; the captured schema contains no data.
  for(const statement of (schema+'\n'+readFileSync(root+'indexes.staging.sql','utf8')).split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(statement).run();
  for(const file of readdirSync(root+'migrations').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(root+'migrations/'+file,'utf8').split(';').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  async function insert(table,row){
    const cols=(await db.prepare('PRAGMA table_info('+table+')').all()).results;
    const complete={};
    for(const c of cols)if(c.notnull && c.dflt_value===null)complete[c.name]=/INT|REAL/i.test(c.type)?0:(c.name==='dados'?'{}':(['lida_por','ocultada_por','reagido_por','curtidas'].includes(c.name)?'[]':''));
    Object.assign(complete,row);
    const keys=Object.keys(complete);
    await db.prepare('INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').bind(...keys.map(k=>complete[k])).run();
  }
  for(const id of ['alice','bob','admin'])await insert('usuarios',{id,nome:id,email:id+'@example.test',estado:'ativo',moldura_atual:'entrelinhas',xp:70,pontos:20,biblioteca_publica:1,is_admin:id==='admin'?1:0,atualizado_em:'2026-11-01T00:00:00Z'});
  const api=async(path,token='alice',method='GET',body)=>{
    const request=new globalThis.Request('https://local.test'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});
    return mf.dispatchFetch(request.url,{method,headers:Object.fromEntries(request.headers),body:body===undefined?undefined:await request.arrayBuffer()});
  };
  return {mf,db,files,insert,api,close:()=>mf.dispose()};
}
