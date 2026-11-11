const object=v=>{try{return typeof v==='string'?JSON.parse(v):v||{}}catch(_){return {}}};
const shape=r=>({...r,fixada:!!r.fixada,editada:!!r.editada,apagada:!!r.apagada,removida:!!r.removida,dados:object(r.dados),reacoes:object(r.reacoes)});
export async function handleChat(request,env,{uid,headers,isAdmin}) {
  const url=new URL(request.url),path=url.pathname;
  if(!path.startsWith('/api/v1/chat/'))return null;
  const reply=(body,status=200)=>Response.json(body,{status,headers});
  async function body(){
    const text=await request.text();if(text.length>32768)throw new TypeError('Mensagem muito grande.');
    const b=JSON.parse(text||'{}');if(!b||typeof b!=='object'||Array.isArray(b))throw new TypeError('Formato inválido.');return b;
  }
  function text(v,max=4000){if(typeof v!=='string'||!v.trim()||v.trim().length>max)throw new TypeError('Texto da mensagem inválido.');return v.trim();}
  try {
    if(path==='/api/v1/chat/messages'&&request.method==='GET'){
      const raw=url.searchParams.get('limit'),limit=raw===null?250:Math.max(1,Math.min(1000,Math.floor(Number(raw)||1)));
      const before=url.searchParams.get('before'),beforeId=url.searchParams.get('before_id');
      if(!!before!==!!beforeId)return reply({ok:false,error:'Use before e before_id juntos.'},400);
      const rows=await env.DB.prepare("SELECT * FROM chat_mensagens WHERE COALESCE(removida,0)=0 AND COALESCE(apagada,0)=0 AND (? IS NULL OR criado_em<? OR (criado_em=? AND id<?)) ORDER BY criado_em DESC,id DESC LIMIT ?").bind(before,before,before,beforeId,limit).all();
      const items=(rows.results||[]).reverse().map(shape),ids=items.map(r=>r.id),reactions=[];
      for(let i=0;i<ids.length;i+=80){
        const chunk=ids.slice(i,i+80),r=await env.DB.prepare('SELECT * FROM chat_reacoes WHERE mensagem_id IN ('+chunk.map(()=>'?').join(',')+') ORDER BY criado_em,id').bind(...chunk).all();
        reactions.push(...r.results);
      }
      const pinned=await env.DB.prepare('SELECT * FROM chat_mensagens WHERE fixada=1 AND COALESCE(removida,0)=0 AND COALESCE(apagada,0)=0 ORDER BY criado_em DESC,id DESC LIMIT 30').all();
      const oldest=items[0];
      return reply({ok:true,items,pins:pinned.results.map(shape),reactions,count:items.length,limit,hasMore:items.length===limit,nextCursor:oldest?{before:oldest.criado_em,before_id:oldest.id}:null});
    }
    if(path==='/api/v1/chat/messages'&&request.method==='POST'){
      const b=await body(),message=text(b.message),id=b.client_id===undefined?crypto.randomUUID():text(b.client_id,128);
      if(!/^[a-zA-Z0-9_-]+$/.test(id))return reply({ok:false,error:'Identificador da mensagem inválido.'},400);
      const previous=await env.DB.prepare('SELECT * FROM chat_mensagens WHERE id=?').bind(id).first();
      if(previous){
        if(previous.usuario_id!==uid||previous.mensagem!==message)return reply({ok:false,error:'Identificador já utilizado.'},409);
        return reply({ok:true,message:shape(previous),already_sent:true});
      }
      let parent=null,quote=null;
      if(b.reply&&b.reply.id){
        parent=await env.DB.prepare('SELECT id,usuario_id,nome,mensagem FROM chat_mensagens WHERE id=? AND COALESCE(removida,0)=0 AND COALESCE(apagada,0)=0').bind(String(b.reply.id)).first();
        if(!parent)return reply({ok:false,error:'Mensagem respondida não encontrada.'},404);
        quote={id:parent.id,userId:parent.usuario_id,userName:parent.nome||'Membro',text:parent.mensagem.slice(0,240)};
      }
      const user=await env.DB.prepare('SELECT nome FROM usuarios WHERE id=?').bind(uid).first();
      const name=user.nome||'Membro',stamp=new Date().toISOString();
      const statements=[env.DB.prepare("INSERT INTO chat_mensagens (id,usuario_id,mensagem,fixada,criado_em,editada,apagada,atualizado_em,reacoes,reagido_por,curtidas,nome,texto,removida,dados) VALUES (?,?,?,0,?,0,0,?,'{}','[]','[]',?,?,0,?) ON CONFLICT(id) DO NOTHING").bind(id,uid,message,stamp,stamp,name,message,JSON.stringify({tipo:'mensagem',client_ref:id,...(quote?{reply:quote}:{})}))];
      if(parent&&parent.usuario_id!==uid){
        statements.push(env.DB.prepare("INSERT INTO app_notificacoes (id,usuario_id,target_id,titulo,mensagem,tipo,lida,lida_por,ocultada_por,origem,dados,criada_em,atualizado_em) SELECT ?,?,?,'Nova resposta no Chat',?,'chat',0,'[]','[]','chat_cloudflare','{}',?,? WHERE EXISTS(SELECT 1 FROM chat_mensagens WHERE id=? AND usuario_id=?) ON CONFLICT(id) DO NOTHING").bind('chat_reply_'+id+'_'+parent.usuario_id,parent.usuario_id,parent.usuario_id,name+' respondeu à sua mensagem.',stamp,stamp,id,uid));
      }
      await env.DB.batch(statements);
      const saved=await env.DB.prepare('SELECT * FROM chat_mensagens WHERE id=? AND usuario_id=?').bind(id,uid).first();
      if(!saved||saved.mensagem!==message)return reply({ok:false,error:'Gravação não confirmada.'},409);
      return reply({ok:true,message:shape(saved)},201);
    }
    const route=path.match(/^\/api\/v1\/chat\/messages\/([^/]+)(?:\/(reaction|pin))?$/);
    if(!route)return null;
    const id=decodeURIComponent(route[1]),action=route[2];
    const row=await env.DB.prepare('SELECT * FROM chat_mensagens WHERE id=? AND COALESCE(removida,0)=0 AND COALESCE(apagada,0)=0').bind(id).first();
    if(!row)return reply({ok:false,error:'Mensagem não encontrada.'},404);
    const stamp=new Date().toISOString(),owner=row.usuario_id===uid,withinWindow=Date.now()-Date.parse(row.criado_em)<=30*60*1000;
    if(action==='reaction'&&request.method==='PUT'){
      const b=await body(),emoji=text(b.emoji,16);
      await env.DB.prepare('INSERT INTO chat_reacoes(id,mensagem_id,usuario_id,emoji,criado_em,atualizado_em) VALUES(?,?,?,?,?,?) ON CONFLICT(mensagem_id,usuario_id) DO UPDATE SET emoji=excluded.emoji,atualizado_em=excluded.atualizado_em').bind(crypto.randomUUID(),id,uid,emoji,stamp,stamp).run();
      return reply({ok:true,message_id:id,emoji});
    }
    if(action==='reaction'&&request.method==='DELETE'){
      await env.DB.prepare('DELETE FROM chat_reacoes WHERE mensagem_id=? AND usuario_id=?').bind(id,uid).run();
      return reply({ok:true,message_id:id,removed:true});
    }
    if(action==='pin'&&request.method==='PATCH'){
      if(!isAdmin)return reply({ok:false,error:'Acesso administrativo necessário.'},403);
      const b=await body();if(typeof b.pinned!=='boolean')return reply({ok:false,error:'Valor de fixação inválido.'},400);
      await env.DB.prepare('UPDATE chat_mensagens SET fixada=?,atualizado_em=? WHERE id=?').bind(b.pinned?1:0,stamp,id).run();
      return reply({ok:true,id,pinned:b.pinned});
    }
    if(!action&&request.method==='PATCH'){
      if(!owner||!withinWindow)return reply({ok:false,error:'Somente o autor pode editar por até 30 minutos.'},403);
      const b=await body(),message=text(b.message);
      await env.DB.prepare('UPDATE chat_mensagens SET mensagem=?,texto=?,editada=1,editado_em=?,atualizado_em=? WHERE id=? AND usuario_id=?').bind(message,message,stamp,stamp,id,uid).run();
      return reply({ok:true,id,message,edited_at:stamp});
    }
    if(!action&&request.method==='DELETE'){
      if(!isAdmin&&!(owner&&withinWindow))return reply({ok:false,error:'Você só pode apagar suas mensagens por até 30 minutos.'},403);
      await env.DB.prepare('UPDATE chat_mensagens SET removida=1,apagada=1,atualizado_em=? WHERE id=?').bind(stamp,id).run();
      return reply({ok:true,id,removed:true});
    }
    return null;
  }catch(e){
    if(e instanceof SyntaxError||e instanceof TypeError)return reply({ok:false,error:'Mensagem ou formato JSON inválido.'},400);
    console.error(JSON.stringify({event:'chat_operation_failed',message:String(e.message)}));
    return reply({ok:false,error:'Não foi possível concluir a operação no chat.'},503);
  }
}
