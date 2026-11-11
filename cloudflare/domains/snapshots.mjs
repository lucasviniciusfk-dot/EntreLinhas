const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
export async function handleSnapshot(request,env,{uid,headers}){
  if(new URL(request.url).pathname!=='/api/v1/me/snapshots/v260'||request.method!=='GET')return null;
  const reply=(body,status)=>Response.json(body,{status,headers});
  try{
    const row=await env.DB.prepare("SELECT * FROM snapshot_archives WHERE owner_id=? AND source_table='entrel_user_snapshot_v260' ORDER BY created_at DESC LIMIT 1").bind(uid).first();
    if(!row)return reply({ok:false,error:'Snapshot arquivado não encontrado.'},404);
    if(row.size_bytes>16*1024*1024)return reply({ok:false,error:'Snapshot excede o limite desta rota de exportação.'},413);
    const file=await env.FILES.get(row.object_key);if(!file)return reply({ok:false,error:'Manifesto indisponível.'},503);
    const manifest=JSON.parse(await file.text()),prefix=row.object_key.slice(0,row.object_key.lastIndexOf('/')+1);
    if(manifest.sha256!==row.sha256||manifest.bytes!==row.size_bytes||!Array.isArray(manifest.parts))return reply({ok:false,error:'Manifesto inconsistente.'},503);
    const full=new Uint8Array(row.size_bytes);let offset=0;
    for(const part of manifest.parts){
      if(typeof part.key!=='string'||!part.key.startsWith(prefix)||!/^part-[0-9]+$/.test(part.key.slice(prefix.length)))return reply({ok:false,error:'Parte inválida.'},503);
      const object=await env.FILES.get(part.key);if(!object)return reply({ok:false,error:'Parte do snapshot indisponível.'},503);
      const bytes=new Uint8Array(await object.arrayBuffer());
      if(bytes.length!==part.bytes||offset+bytes.length>full.length||await sha(bytes)!==part.sha256)return reply({ok:false,error:'Integridade da parte não confirmada.'},503);
      full.set(bytes,offset);offset+=bytes.length;
    }
    if(offset!==full.length||await sha(full)!==row.sha256)return reply({ok:false,error:'Integridade do snapshot não confirmada.'},503);
    const out=new Headers(headers);out.set('Content-Type','application/json; charset=utf-8');out.set('Content-Length',String(full.length));out.set('Content-Disposition','attachment; filename="entrelinhas-snapshot-v260.json"');out.set('X-Content-Type-Options','nosniff');
    return new Response(full,{headers:out});
  }catch(_){return reply({ok:false,error:'Não foi possível recuperar o snapshot preservado.'},503);}
}
